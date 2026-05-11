import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.config import settings
from backend.models.auth_log import AuthEventLog, TokenBlocklist
from backend.models.reset_token import PasswordResetToken
from backend.models.user import User
from backend.services.crypto_service import decrypt_text, encrypt_text
from backend.services.hash_service import generate_salt, hash_password, verify_password
from backend.services.totp_service import generate_qr_code_base64, generate_totp_secret, verify_totp

_RESET_TOKEN_EXPIRE_MINUTES = 15


# ── JWT ───────────────────────────────────────────────────────────────────────

def _create_jwt(data: dict, expires_delta: timedelta) -> str:
    payload = {
        **data,
        "jti": str(uuid4()),
        "exp": datetime.now(timezone.utc) + expires_delta,
    }
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


def decode_access_token(token: str) -> tuple[UUID, str]:
    """Decodifica e valida o JWT final de acesso. Retorna (user_id, jti)."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("Token inválido ou expirado") from exc

    if payload.get("stage") != "authenticated":
        raise ValueError("Token de acesso inválido")

    try:
        return UUID(payload["sub"]), payload["jti"]
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


# ── Blocklist de tokens ───────────────────────────────────────────────────────

async def revoke_token(jti: str, expires_at: datetime, db: AsyncSession) -> None:
    """Adiciona o JTI à blocklist, impedindo reutilização até a expiração natural."""
    db.add(TokenBlocklist(jti=jti, expires_at=expires_at))
    await db.commit()


async def is_token_revoked(jti: str, db: AsyncSession) -> bool:
    """Retorna True se o JTI constar na blocklist (token invalidado por logout)."""
    result = await db.execute(select(TokenBlocklist).where(TokenBlocklist.jti == jti))
    return result.scalar_one_or_none() is not None


# ── Log de eventos de autenticação ────────────────────────────────────────────

async def log_auth_event(
    user_id: UUID | None,
    event_type: str,
    ip_address: str | None,
    detail: str | None,
    db: AsyncSession,
) -> None:
    db.add(AuthEventLog(
        user_id=user_id,
        event_type=event_type,
        ip_address=ip_address,
        detail=detail,
    ))
    await db.commit()


# ── Logout ────────────────────────────────────────────────────────────────────

async def logout_user(token: str, db: AsyncSession, ip_address: str | None = None) -> None:
    """Invalida o token atual inserindo seu JTI na blocklist."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    except JWTError as exc:
        raise ValueError("Token inválido ou expirado") from exc

    if payload.get("stage") != "authenticated":
        raise ValueError("Token de acesso inválido")

    jti: str = payload.get("jti", "")
    if not jti:
        raise ValueError("Token sem JTI — não pode ser invalidado")

    try:
        user_id = UUID(payload["sub"])
    except (KeyError, ValueError) as exc:
        raise ValueError("Token com subject inválido") from exc

    exp = payload.get("exp")
    expires_at = (
        datetime.fromtimestamp(exp, tz=timezone.utc)
        if exp
        else datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )

    if not await is_token_revoked(jti, db):
        await revoke_token(jti=jti, expires_at=expires_at, db=db)

    await log_auth_event(
        user_id=user_id,
        event_type="logout",
        ip_address=ip_address,
        detail=None,
        db=db,
    )


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

async def login_user(
    email: str,
    password: str,
    db: AsyncSession,
    ip_address: str | None = None,
) -> str:
    """Verifica as credenciais e retorna o token temporário pré-2FA."""
    result = await db.execute(select(User).where(User.email == email))
    user: User | None = result.scalar_one_or_none()

    # Sempre executa a verificação para evitar enumeração por tempo de resposta
    if user is None:
        verify_password(password, "0" * 64, "$argon2id$v=19$m=65536,t=3,p=2$dummy$dummy")
        await log_auth_event(None, "login_failure", ip_address, "invalid_credentials", db)
        raise ValueError("E-mail ou senha inválidos")

    if not verify_password(password, user.password_salt, user.password_hash):
        await log_auth_event(user.id, "login_failure", ip_address, "invalid_credentials", db)
        raise ValueError("E-mail ou senha inválidos")

    await log_auth_event(user.id, "login_success", ip_address, None, db)
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
        plain_secret = generate_totp_secret()
        user.totp_secret = encrypt_text(plain_secret)   # cifra antes de persistir
        await db.commit()
        await db.refresh(user)

    plain_secret = decrypt_text(user.totp_secret)       # decifra para uso em memória
    return {
        "secret":    plain_secret,
        "qr_base64": generate_qr_code_base64(user.email, plain_secret),
    }


# ── Verificação do 2FA (Etapa 2) ─────────────────────────────────────────────

async def verify_2fa_and_issue_token(
    temp_token: str,
    totp_code: str,
    db: AsyncSession,
    ip_address: str | None = None,
) -> str:
    """Valida o código TOTP e emite o JWT final de acesso."""
    user_id = decode_temp_token(temp_token)

    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()
    if user is None:
        raise ValueError("Usuário não encontrado")

    if not user.totp_secret:
        raise ValueError("2FA não configurado. Chame /auth/2fa/setup primeiro.")

    plain_secret = decrypt_text(user.totp_secret)       # decifra para verificação TOTP
    if not verify_totp(plain_secret, totp_code):
        await log_auth_event(user_id, "2fa_failure", ip_address, "invalid_totp", db)
        raise ValueError("Código TOTP inválido ou expirado")

    if not user.is_2fa_enabled:
        user.is_2fa_enabled = True
        await db.commit()

    await log_auth_event(user_id, "2fa_success", ip_address, None, db)
    return create_access_token(user.id)


# ── Recuperação de Senha ──────────────────────────────────────────────────────

def _hash_reset_token(token: str) -> str:
    """SHA-256 do token — o que é armazenado no banco."""
    return hashlib.sha256(token.encode()).hexdigest()


async def request_password_reset(
    email: str,
    db: AsyncSession,
    ip_address: str | None = None,
) -> str | None:
    """Gera token de recuperação de senha.

    Retorna o token em texto claro apenas para uso em desenvolvimento.
    Em produção, este token deve ser enviado por e-mail e esta função
    não deve expor o valor — retornar None e enviar via SMTP.
    A resposta HTTP ao cliente é sempre idêntica (prevenção de enumeração).
    """
    result = await db.execute(select(User).where(User.email == email))
    user: User | None = result.scalar_one_or_none()

    await log_auth_event(
        user_id=user.id if user else None,
        event_type="password_reset_request",
        ip_address=ip_address,
        detail=None,
        db=db,
    )

    if user is None:
        return None

    token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=_RESET_TOKEN_EXPIRE_MINUTES)

    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_reset_token(token),
        expires_at=expires_at,
    ))
    await db.commit()
    return token


async def reset_password(
    token: str,
    new_password: str,
    db: AsyncSession,
    ip_address: str | None = None,
) -> None:
    """Valida o token e aplica o novo hash de senha."""
    token_hash = _hash_reset_token(token)
    now = datetime.now(timezone.utc)

    result = await db.execute(
        select(PasswordResetToken).where(PasswordResetToken.token_hash == token_hash)
    )
    record: PasswordResetToken | None = result.scalar_one_or_none()

    if record is None:
        raise ValueError("Token inválido")

    if record.used_at is not None:
        await log_auth_event(record.user_id, "password_reset_failure", ip_address, "token_already_used", db)
        raise ValueError("Token já utilizado")

    if record.expires_at < now:
        await log_auth_event(record.user_id, "password_reset_failure", ip_address, "token_expired", db)
        raise ValueError("Token expirado. Solicite um novo link de recuperação.")

    result = await db.execute(select(User).where(User.id == record.user_id))
    user: User | None = result.scalar_one_or_none()
    if user is None:
        raise ValueError("Usuário não encontrado")

    new_salt = generate_salt()
    user.password_hash = hash_password(new_password, new_salt)
    user.password_salt = new_salt
    record.used_at = now

    await db.commit()
    await log_auth_event(user.id, "password_reset_success", ip_address, None, db)
