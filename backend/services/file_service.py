import uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

import aiofiles
from fastapi import UploadFile
from sqlalchemy import select
from sqlalchemy.orm import aliased
from sqlalchemy.ext.asyncio import AsyncSession

from backend.models.file import File, FileAccessLog, FileShare
from backend.models.user import User

UPLOAD_BASE = Path(__file__).parent.parent / "uploads"

ALLOWED_EXTENSIONS = {".rvt", ".ifc", ".nwd", ".nwc", ".pln", ".dwg", ".dxf", ".pdf"}

MAX_FILE_SIZE = 200 * 1024 * 1024  # 200 MB

_MIME_MAP = {
    ".rvt": "application/octet-stream",
    ".ifc": "application/x-step",
    ".nwd": "application/octet-stream",
    ".nwc": "application/octet-stream",
    ".pln": "application/octet-stream",
    ".dwg": "application/acad",
    ".dxf": "application/dxf",
    ".pdf": "application/pdf",
}


def _ext(filename: str) -> str:
    return Path(filename).suffix.lower()


def _log(file_id: UUID | None, user_id: UUID, action: str) -> FileAccessLog:
    return FileAccessLog(file_id=file_id, accessed_by=user_id, action=action)


async def _get_owned_file(file_id: UUID, owner: User, db: AsyncSession) -> File:
    result = await db.execute(
        select(File).where(File.id == file_id, File.is_deleted.is_(False))
    )
    record: File | None = result.scalar_one_or_none()
    if record is None:
        raise ValueError("Arquivo não encontrado")
    if record.owner_id != owner.id:
        raise ValueError("Acesso negado")
    return record


# ── Upload ────────────────────────────────────────────────────────────────────

async def upload_file(
    owner: User,
    upload: UploadFile,
    description: str | None,
    db: AsyncSession,
) -> File:
    ext = _ext(upload.filename or "")
    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Tipo de arquivo não permitido. Aceitos: {', '.join(sorted(ALLOWED_EXTENSIONS))}"
        )

    content = await upload.read()
    if len(content) == 0:
        raise ValueError("Arquivo vazio")
    if len(content) > MAX_FILE_SIZE:
        raise ValueError("Arquivo muito grande. Limite máximo: 200 MB")

    user_dir = UPLOAD_BASE / str(owner.id)
    user_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4()}{ext}"
    dest = user_dir / stored_name

    async with aiofiles.open(dest, "wb") as fh:
        await fh.write(content)

    record = File(
        owner_id=owner.id,
        original_filename=upload.filename or stored_name,
        stored_filename=stored_name,
        file_size=len(content),
        mime_type=_MIME_MAP.get(ext, "application/octet-stream"),
        description=description or None,
    )
    db.add(record)
    await db.flush()
    db.add(_log(record.id, owner.id, "upload"))
    await db.commit()
    await db.refresh(record)
    return record


# ── Listagem ──────────────────────────────────────────────────────────────────

async def list_user_files(owner: User, db: AsyncSession) -> list[File]:
    result = await db.execute(
        select(File)
        .where(File.owner_id == owner.id, File.is_deleted.is_(False))
        .order_by(File.uploaded_at.desc())
    )
    return list(result.scalars().all())


# ── Download ──────────────────────────────────────────────────────────────────

async def get_file_for_download(
    file_id: UUID,
    user: User,
    db: AsyncSession,
) -> tuple[File, Path]:
    result = await db.execute(
        select(File).where(File.id == file_id, File.is_deleted.is_(False))
    )
    record: File | None = result.scalar_one_or_none()
    if record is None:
        raise ValueError("Arquivo não encontrado")

    # Dono tem acesso direto; outros precisam ter compartilhamento ativo
    if record.owner_id != user.id:
        share_result = await db.execute(
            select(FileShare).where(
                FileShare.file_id == file_id,
                FileShare.shared_with == user.id,
                FileShare.revoked_at.is_(None),
            )
        )
        if share_result.scalar_one_or_none() is None:
            raise ValueError("Acesso negado")

    # Arquivo sempre fica na pasta do dono
    path = UPLOAD_BASE / str(record.owner_id) / record.stored_filename
    if not path.exists():
        raise ValueError("Arquivo não encontrado no servidor")

    db.add(_log(file_id, user.id, "download"))
    await db.commit()
    return record, path


# ── Exclusão ──────────────────────────────────────────────────────────────────

async def delete_file(file_id: UUID, owner: User, db: AsyncSession) -> None:
    record = await _get_owned_file(file_id, owner, db)
    db.add(_log(file_id, owner.id, "delete"))
    record.is_deleted = True
    await db.commit()


# ── Compartilhamento ──────────────────────────────────────────────────────────

async def share_file(
    file_id: UUID,
    owner: User,
    recipient_matricula: str,
    db: AsyncSession,
) -> tuple[FileShare, User]:
    await _get_owned_file(file_id, owner, db)

    # Busca destinatário pela matrícula
    result = await db.execute(select(User).where(User.matricula == recipient_matricula))
    recipient: User | None = result.scalar_one_or_none()
    if recipient is None:
        raise ValueError("Nenhum aluno encontrado com esta matrícula")
    if recipient.id == owner.id:
        raise ValueError("Você não pode compartilhar um arquivo consigo mesmo")

    # Verifica se já existe compartilhamento ativo
    dup = await db.execute(
        select(FileShare).where(
            FileShare.file_id == file_id,
            FileShare.shared_with == recipient.id,
            FileShare.revoked_at.is_(None),
        )
    )
    if dup.scalar_one_or_none() is not None:
        raise ValueError("Este arquivo já está compartilhado com este aluno")

    now = datetime.now(timezone.utc)
    share = FileShare(
        file_id=file_id,
        shared_by=owner.id,
        shared_with=recipient.id,
        permission="download",
        lgpd_consent_at=now,
    )
    db.add(share)
    db.add(_log(file_id, owner.id, "share"))
    await db.commit()
    await db.refresh(share)
    return share, recipient


async def list_file_shares(
    file_id: UUID,
    owner: User,
    db: AsyncSession,
) -> list[tuple[FileShare, User]]:
    await _get_owned_file(file_id, owner, db)

    Recipient = aliased(User)
    result = await db.execute(
        select(FileShare, Recipient)
        .join(Recipient, FileShare.shared_with == Recipient.id)
        .where(FileShare.file_id == file_id, FileShare.revoked_at.is_(None))
        .order_by(FileShare.shared_at.desc())
    )
    return list(result.all())


async def revoke_share(
    file_id: UUID,
    share_id: UUID,
    owner: User,
    db: AsyncSession,
) -> None:
    await _get_owned_file(file_id, owner, db)

    result = await db.execute(
        select(FileShare).where(
            FileShare.id == share_id,
            FileShare.file_id == file_id,
            FileShare.revoked_at.is_(None),
        )
    )
    share: FileShare | None = result.scalar_one_or_none()
    if share is None:
        raise ValueError("Compartilhamento não encontrado")

    share.revoked_at = datetime.now(timezone.utc)
    db.add(_log(file_id, owner.id, "revoke"))
    await db.commit()


async def list_shared_with_me(
    user: User,
    db: AsyncSession,
) -> list[tuple[File, FileShare, User]]:
    Owner = aliased(User)
    result = await db.execute(
        select(File, FileShare, Owner)
        .join(FileShare, FileShare.file_id == File.id)
        .join(Owner, FileShare.shared_by == Owner.id)
        .where(
            FileShare.shared_with == user.id,
            FileShare.revoked_at.is_(None),
            File.is_deleted.is_(False),
        )
        .order_by(FileShare.shared_at.desc())
    )
    return list(result.all())
