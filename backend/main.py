from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from backend.config import settings
from backend.database.db import init_db
from backend.limiter import limiter
from backend.routers import auth, files


@asynccontextmanager
async def lifespan(app: FastAPI):
    print("🚀 BIM Repository Auth Backend starting…")
    await init_db()
    print("✅ Database tables verified/created.")
    yield
    print("🛑 BIM Repository Auth Backend shutting down.")


app = FastAPI(
    title="BIM Repository — Authentication API",
    version="1.0.0",
    lifespan=lifespan,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Tente novamente mais tarde."},
    )

_cors_origins = (
    ["*"] if settings.ALLOWED_ORIGINS == "*"
    else [o.strip() for o in settings.ALLOWED_ORIGINS.split(",")]
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(files.router)


@app.get("/health", tags=["Sistema"])
async def health_check() -> dict:
    return {"status": "healthy", "service": "BIM Repository Auth API"}
