from datetime import datetime, timedelta, timezone
from uuid import UUID

from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.models.user import User
from backend.services.hash_service import generate_salt, hash_password, verify_password
from backend.services.totp_service import generate_qr_code_base64, generate_totp_secret, verify_totp


# ── JWT ───────────────────────────────────────────────────────────────────────

def _create_jwt(data: dict, expires_delta: timedelta) -> str:
    payload = {**data, "exp": datetime.now(timezone.utc) + expires_delta}
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=settings.ALGORITHM)


def create_temp_token(user_id: UUID) -> str:
    """Token temporário (pré-2FA) com validade de 1 minuto.

    O TOTP do authenticator gera um novo código a cada 30 s, portanto
    1 minuto cobre ≈ 2 janelas de rotação — tempo suficiente para o
    usuário abrir o app e digitar o código, sem que o token persista
    além da sessão de login atual. Em caso de logout, um novo login
    gera um novo temp_token, invalidando qualquer token anterior.
    """
    return _create_jwt(
        {"sub": str(user_id), "stage": "pre_2fa"},
        timedelta(minutes=settings.TEMP_TOKEN_EXPIRE_MINUTES),
    )


def create_access_token(user_id: UUID) -> str:
    """JWT final emitido após a validação do 2FA."""
    return _create_jwt(
        {"sub": str(user_id), "stage": "authenticated"},
        timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def decode_access_token(token: str) -> UUID:
    """Decodifica e valida o JWT final de acesso. Lança ValueError se inválido."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("Token inválido ou expirado") from exc

    if payload.get("stage") != "authenticated":
        raise ValueError("Token de acesso inválido")

    try:
        return UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise ValueError("Token com subject inválido") from exc


def decode_temp_token(token: str) -> UUID:
    """Decodifica e valida o token pré-2FA. Lança ValueError se inválido."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("Token inválido ou expirado") from exc

    if payload.get("stage") != "pre_2fa":
        raise ValueError("Token não é do tipo pré-2FA")

    try:
        return UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise ValueError("Token com subject inválido") from exc


# ── Registro ──────────────────────────────────────────────────────────────────

async def register_user(
    matricula: str,
    full_name: str,
    course: str,
    email: str,
    password: str,
    db: AsyncSession,
) -> User:
    """Cadastra um novo usuário com hash Argon2id e salt único."""
    existing_matricula = await db.execute(select(User).where(User.matricula == matricula))
    if existing_matricula.scalar_one_or_none() is not None:
        raise ValueError("Já existe uma conta com esta matrícula")

    existing_email = await db.execute(select(User).where(User.email == email))
    if existing_email.scalar_one_or_none() is not None:
        raise ValueError("Já existe uma conta com este e-mail")

    salt = generate_salt()
    now = datetime.now(timezone.utc)
    user = User(
        matricula=matricula,
        full_name=full_name,
        course=course,
        email=email,
        password_hash=hash_password(password, salt),
        password_salt=salt,
        terms_accepted=True,
        terms_accepted_at=now,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user


# ── Login (Etapa 1) ───────────────────────────────────────────────────────────

async def login_user(email: str, password: str, db: AsyncSession) -> str:
    """Verifica as credenciais e retorna o token temporário pré-2FA."""
    result = await db.execute(select(User).where(User.email == email))
    user: User | None = result.scalar_one_or_none()

    # Sempre executa a verificação para evitar enumeração por tempo de resposta
    if user is None:
        verify_password(password, "0" * 64, "$argon2id$v=19$m=65536,t=3,p=2$dummy$dummy")
        raise ValueError("E-mail ou senha inválidos")

    if not verify_password(password, user.password_salt, user.password_hash):
        raise ValueError("E-mail ou senha inválidos")

    return create_temp_token(user.id)


# ── Configuração do 2FA ───────────────────────────────────────────────────────

async def setup_2fa(user_id: UUID, db: AsyncSession) -> dict:
    """Gera o segredo TOTP e retorna o QR Code em base64.
    
    Se o usuário já possui um secret (setup chamado mais de uma vez),
    reutiliza o existente para não invalidar o QR Code já escaneado.
    """
    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()
    if user is None:
        raise ValueError("Usuário não encontrado")

    # Só gera novo secret se ainda não existir — evita invalidar QR já escaneado
    if not user.totp_secret:
        user.totp_secret = generate_totp_secret()
        await db.commit()
        await db.refresh(user)

    return {
        "secret": user.totp_secret,
        "qr_base64": generate_qr_code_base64(user.email, user.totp_secret),
    }


# ── Verificação do 2FA (Etapa 2) ─────────────────────────────────────────────

async def verify_2fa_and_issue_token(temp_token: str, totp_code: str, db: AsyncSession) -> str:
    """Valida o código TOTP e emite o JWT final de acesso."""
    user_id = decode_temp_token(temp_token)

    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()
    if user is None:
        raise ValueError("Usuário não encontrado")

    if not user.totp_secret:
        raise ValueError("2FA não configurado. Chame /auth/2fa/setup primeiro.")

    if not verify_totp(user.totp_secret, totp_code):
        raise ValueError("Código TOTP inválido ou expirado")

    if not user.is_2fa_enabled:
        user.is_2fa_enabled = True
        await db.commit()

    return create_access_token(user.id)
