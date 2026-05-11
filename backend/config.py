from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_ENV_FILE = Path(__file__).parent / ".env"


class Settings(BaseSettings):
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    TEMP_TOKEN_EXPIRE_MINUTES: int = 3  # 3 min — covers scan QR + enter TOTP code (≈ 6 TOTP cycles)
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    DATABASE_URL: str
    TOTP_ISSUER_NAME: str = "BIM Repository"

    # Supabase Storage
    SUPABASE_URL: str
    SUPABASE_SERVICE_KEY: str
    STORAGE_BUCKET: str = "bim-files"

    # CORS — use "*" for development, comma-separated URLs for production
    ALLOWED_ORIGINS: str = "*"

    model_config = SettingsConfigDict(
        env_file=_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
    )


settings = Settings()
