import ssl as _ssl
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from backend.config import settings


def _build_engine():
    # asyncpg rejects libpq params (sslmode, channel_binding) in the URL.
    # Strip them and convert sslmode=require to connect_args instead.
    parsed = urlparse(settings.DATABASE_URL)
    params = parse_qs(parsed.query, keep_blank_values=True)

    sslmode = params.pop("sslmode", [None])[0]
    params.pop("channel_binding", None)

    clean_url = urlunparse(parsed._replace(query=urlencode({k: v[0] for k, v in params.items()})))

    connect_args: dict = {}
    if sslmode in ("require", "verify-ca", "verify-full"):
        connect_args["ssl"] = _ssl.create_default_context()

    return create_async_engine(clean_url, connect_args=connect_args, pool_pre_ping=True, echo=False)


engine = _build_engine()

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncSession:
    """Dependência FastAPI — fornece uma sessão de banco por requisição."""
    async with AsyncSessionLocal() as session:
        yield session


async def _apply_migrations(conn) -> None:
    """Migrações incrementais — todas idempotentes, seguras em qualquer restart."""

    # req. 4.7 — versão dos termos aceitos
    await conn.execute(text(
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS "
        "terms_version VARCHAR(10) NOT NULL DEFAULT '1.0'"
    ))

    # req. 5.3 — proteção contra alteração de logs (PostgreSQL 15 — sem IF NOT EXISTS no trigger)
    # A função é CREATE OR REPLACE (sempre seguro); os triggers usam bloco DO com EXCEPTION
    # para ignorar silenciosamente duplicatas em restarts do servidor.
    await conn.execute(text("""
        CREATE OR REPLACE FUNCTION prevent_log_modification()
        RETURNS trigger LANGUAGE plpgsql AS $$
        BEGIN
            IF TG_OP = 'DELETE' THEN
                RAISE EXCEPTION 'Registros de log são imutáveis — exclusão não permitida';
            END IF;
            IF TG_OP = 'UPDATE' THEN
                IF TG_TABLE_NAME = 'auth_event_logs' THEN
                    IF OLD.event_type  IS DISTINCT FROM NEW.event_type  OR
                       OLD.ip_address  IS DISTINCT FROM NEW.ip_address  OR
                       OLD.detail      IS DISTINCT FROM NEW.detail       OR
                       OLD.created_at  IS DISTINCT FROM NEW.created_at  THEN
                        RAISE EXCEPTION 'Conteúdo de auth_event_logs não pode ser alterado';
                    END IF;
                ELSIF TG_TABLE_NAME = 'file_access_logs' THEN
                    IF OLD.action      IS DISTINCT FROM NEW.action      OR
                       OLD.accessed_at IS DISTINCT FROM NEW.accessed_at THEN
                        RAISE EXCEPTION 'Conteúdo de file_access_logs não pode ser alterado';
                    END IF;
                END IF;
            END IF;
            RETURN NEW;
        END;
        $$;
    """))

    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TRIGGER no_modify_auth_logs
                BEFORE UPDATE OR DELETE ON auth_event_logs
                FOR EACH ROW EXECUTE FUNCTION prevent_log_modification();
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))

    await conn.execute(text("""
        DO $$ BEGIN
            CREATE TRIGGER no_modify_file_logs
                BEFORE UPDATE OR DELETE ON file_access_logs
                FOR EACH ROW EXECUTE FUNCTION prevent_log_modification();
        EXCEPTION WHEN duplicate_object THEN NULL;
        END $$;
    """))


async def init_db() -> None:
    """Cria as tabelas e aplica migrações incrementais."""
    from backend.models import user, file, auth_log, reset_token  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        await _apply_migrations(conn)
