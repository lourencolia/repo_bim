import ssl as _ssl
from urllib.parse import parse_qs, urlencode, urlparse, urlunparse

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


async def init_db() -> None:
    """Cria as tabelas no banco se ainda não existirem."""
    from backend.models import user, file, auth_log, reset_token  # noqa: F401

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
