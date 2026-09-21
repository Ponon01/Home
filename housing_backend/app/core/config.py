from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/astana_opera_housing"
    SYNC_DATABASE_URL: str = "postgresql://postgres:postgres@localhost:5432/astana_opera_housing"
    AUTH_SECRET_KEY: str = "change-me-in-env"
    AUTH_ALGORITHM: str = "HS256"
    AUTH_ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    UPLOAD_DIR: str = "uploads"
    CORS_ORIGINS: str = (
        "http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,http://127.0.0.1:5173"
    )
    # Lightweight admin gate for frontend modal login (Departments).
    # Default matches seed admin password; override via env in production.
    ADMIN_GATE_PASSWORD: str = "admin123"

    @property
    def upload_path(self) -> Path:
        return Path(self.UPLOAD_DIR).resolve()

    @property
    def cors_origins_list(self) -> list[str]:
        origins: list[str] = []
        for raw in self.CORS_ORIGINS.split(","):
            item = raw.strip().rstrip("/")
            if item and item not in origins:
                origins.append(item)
        return origins


settings = Settings()
