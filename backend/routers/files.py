from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.db import get_db
from backend.dependencies import get_current_user
from backend.models.user import User
from backend.services import file_service

router = APIRouter(prefix="/files", tags=["Arquivos"])


def _serialize_file(f) -> dict:
    return {
        "id":                str(f.id),
        "original_filename": f.original_filename,
        "file_size":         f.file_size,
        "mime_type":         f.mime_type,
        "description":       f.description,
        "uploaded_at":       f.uploaded_at.isoformat(),
    }


# ── Upload ─────────────────────────────────────────────────────────────────

@router.post("/upload", status_code=status.HTTP_201_CREATED)
async def upload(
    file: UploadFile = File(...),
    description: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        record = await file_service.upload_file(current_user, file, description, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))
    return {**_serialize_file(record), "message": "Arquivo enviado com sucesso."}


# ── Listagem ───────────────────────────────────────────────────────────────

@router.get("/mine")
async def list_mine(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    files = await file_service.list_user_files(current_user, db)
    return [_serialize_file(f) for f in files]


# IMPORTANTE: rota estática antes das rotas com parâmetro /{file_id}
@router.get("/shared-with-me")
async def shared_with_me(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rows = await file_service.list_shared_with_me(current_user, db)
    return [
        {
            **_serialize_file(f),
            "share_id":            str(share.id),
            "shared_at":           share.shared_at.isoformat(),
            "shared_by_name":      owner.full_name,
            "shared_by_matricula": owner.matricula,
        }
        for f, share, owner in rows
    ]


# ── Download ───────────────────────────────────────────────────────────────

@router.get("/{file_id}/download")
async def download(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        record, file_bytes = await file_service.get_file_for_download(file_id, current_user, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
    return Response(
        content=file_bytes,
        media_type=record.mime_type,
        headers={"Content-Disposition": f'attachment; filename="{record.original_filename}"'},
    )


# ── Exclusão ───────────────────────────────────────────────────────────────

@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await file_service.delete_file(file_id, current_user, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))


# ── Compartilhamento ───────────────────────────────────────────────────────

class ShareRequest(BaseModel):
    recipient_matricula: str
    lgpd_consent: bool


@router.post("/{file_id}/share", status_code=status.HTTP_201_CREATED)
async def share_file(
    file_id: UUID,
    body: ShareRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not body.lgpd_consent:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="É necessário confirmar o consentimento LGPD para compartilhar.",
        )
    try:
        share, recipient = await file_service.share_file(
            file_id, current_user, body.recipient_matricula, db
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return {
        "share_id":              str(share.id),
        "shared_with_name":      recipient.full_name,
        "shared_with_matricula": recipient.matricula,
        "shared_at":             share.shared_at.isoformat(),
        "permission":            share.permission,
    }


@router.get("/{file_id}/shares")
async def list_shares(
    file_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        rows = await file_service.list_file_shares(file_id, current_user, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))

    return [
        {
            "share_id":              str(share.id),
            "shared_with_name":      recipient.full_name,
            "shared_with_matricula": recipient.matricula,
            "shared_at":             share.shared_at.isoformat(),
            "permission":            share.permission,
        }
        for share, recipient in rows
    ]


@router.delete("/{file_id}/share/{share_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_share(
    file_id: UUID,
    share_id: UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    try:
        await file_service.revoke_share(file_id, share_id, current_user, db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc))
