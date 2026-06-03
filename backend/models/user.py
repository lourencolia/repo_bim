import uuid
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, Text  # noqa: F401 (Text usado em totp_secret)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column

from backend.database.db import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True),
        primary_key=True,
        default=uuid.uuid4,
    )
    # Chave de negócio — identificador único do aluno na universidade
    matricula: Mapped[str] = mapped_column(
        String(20),
        unique=True,
        index=True,
        nullable=False,
    )
    full_name: Mapped[str] = mapped_column(String(200), nullable=False)
    course: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(
        String(320),
        unique=True,
        index=True,
        nullable=False,
    )
    # Hash e salt Argon2id armazenados separadamente
    password_hash: Mapped[str] = mapped_column(Text, nullable=False)
    password_salt: Mapped[str] = mapped_column(String(64), nullable=False)

    # Segredo TOTP cifrado com AES-256-GCM — nulo até o 2FA ser configurado
    # Formato: 'enc:<base64(nonce+ct)>' — Text para acomodar o valor cifrado
    totp_secret: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    is_2fa_enabled: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    # Aceite dos termos de uso (LGPD — req. 4.4 / 4.7)
    terms_accepted: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    terms_accepted_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True, default=None
    )
    # Versão dos termos aceitos — req. 4.7 (registro de data e versão)
    terms_version: Mapped[str] = mapped_column(
        String(10), nullable=False, server_default="1.0", default="1.0"
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    def __repr__(self) -> str:
        return f"<User id={self.id!s} matricula={self.matricula!r} email={self.email!r}>"
