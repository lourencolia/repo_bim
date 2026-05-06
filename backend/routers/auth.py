from datetime import datetime
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.database.db import get_db
from backend.dependencies import get_current_user
from backend.models.file import File, FileAccessLog
from backend.models.user import User
from backend.services import auth_service

router = APIRouter(prefix="/auth", tags=["Autenticação"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class RegisterRequest(BaseModel):
    matricula: str = Field(..., min_length=3, max_length=20)
    full_name: str = Field(..., min_length=3, max_length=200)
    course: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=12, max_length=128)
    terms_accepted: bool


class RegisterResponse(BaseModel):
    user_id: UUID
    matricula: str
    email: str
    message: str


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1, max_length=128)


class TokenResponse(BaseModel):
    token: str
    token_type: str = "bearer"
    message: str


class MeResponse(BaseModel):
    user_id: UUID
    matricula: str
    full_name: str
    course: str
    email: str
    created_at: datetime


class Setup2FARequest(BaseModel):
    temp_token: str


class Setup2FAResponse(BaseModel):
    secret: str
    qr_base64: str
    message: str


class Verify2FARequest(BaseModel):
    temp_token: str
    totp_code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/register", response_model=RegisterResponse, status_code=status.HTTP_201_CREATED)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)) -> RegisterResponse:
    """Cria um novo usuário com hash Argon2id e salt único."""
    if not body.terms_accepted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="É obrigatório aceitar os Termos de Uso para criar uma conta.",
        )
    try:
        user = await auth_service.register_user(
            matricula=body.matricula,
            full_name=body.full_name,
            course=body.course,
            email=body.email,
            password=body.password,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return RegisterResponse(
        user_id=user.id,
        matricula=user.matricula,
        email=user.email,
        message="Conta criada com sucesso. Prossiga para /auth/login.",
    )


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Etapa 1 — verifica e-mail e senha, retorna token temporário (3 min)."""
    try:
        temp_token = await auth_service.login_user(email=body.email, password=body.password, db=db)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(token=temp_token, message="Senha verificada. Use este token em /auth/2fa/verify.")


@router.post("/2fa/setup", response_model=Setup2FAResponse)
async def setup_2fa(body: Setup2FARequest, db: AsyncSession = Depends(get_db)) -> Setup2FAResponse:
    """Gera segredo TOTP e QR Code para configuração no Google Authenticator."""
    try:
        user_id = auth_service.decode_temp_token(body.temp_token)
        result = await auth_service.setup_2fa(user_id=user_id, db=db)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc))

    return Setup2FAResponse(
        secret=result["secret"],
        qr_base64=result["qr_base64"],
        message="Escaneie o QR Code e chame /auth/2fa/verify para ativar o 2FA.",
    )


@router.post("/2fa/verify", response_model=TokenResponse)
async def verify_2fa(body: Verify2FARequest, db: AsyncSession = Depends(get_db)) -> TokenResponse:
    """Etapa 2 — valida o código TOTP e retorna o JWT final de acesso."""
    try:
        access_token = await auth_service.verify_2fa_and_issue_token(
            temp_token=body.temp_token,
            totp_code=body.totp_code,
            db=db,
        )
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=str(exc),
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(token=access_token, message="2FA verificado. Autenticação completa.")


@router.get("/me", response_model=MeResponse)
async def me(current_user: User = Depends(get_current_user)) -> MeResponse:
    """Retorna os dados do usuário autenticado."""
    return MeResponse(
        user_id=current_user.id,
        matricula=current_user.matricula,
        full_name=current_user.full_name,
        course=current_user.course,
        email=current_user.email,
        created_at=current_user.created_at,
    )


@router.get("/me/activity")
async def my_activity(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Retorna as últimas 15 ações do usuário — trilha de auditoria LGPD."""
    stmt = (
        select(FileAccessLog, File)
        .outerjoin(File, FileAccessLog.file_id == File.id)
        .where(FileAccessLog.accessed_by == current_user.id)
        .order_by(FileAccessLog.accessed_at.desc())
        .limit(15)
    )
    result = await db.execute(stmt)
    return [
        {
            "action":      log.action,
            "filename":    f.original_filename if f else "Arquivo removido",
            "accessed_at": log.accessed_at.isoformat(),
        }
        for log, f in result.all()
    ]
