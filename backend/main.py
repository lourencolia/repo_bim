from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.database.db import init_db
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

# Usamos Bearer token no localStorage, não cookies — allow_origins=["*"] é seguro aqui
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(files.router)


@app.get("/health", tags=["Sistema"])
async def health_check() -> dict:
    return {"status": "healthy", "service": "BIM Repository Auth API"}
