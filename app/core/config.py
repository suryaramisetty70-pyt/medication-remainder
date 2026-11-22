import os
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Centralized app configuration for CareSync.
    """
    app_name: str = "CareSync"
    app_tagline: str = "Helping families stay connected, one medicine at a time."
    app_url: str = "http://localhost:8000"

    # Database
    database_url: str = "sqlite:///./medreminder.db"

    # Security & JWT
    secret_key: str = "caresync-jwt-super-secret-key-2026-production"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24 * 7  # 7 days persistent session
    refresh_token_expire_days: int = 30
    cookie_name: str = "caresync_token"

    # SMTP / Email
    smtp_host: str = "smtp.gmail.com"
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_name: str = "CareSync Medicine Alert"
    email_from: str = ""

    # File Storage
    upload_dir: str = "uploads/proofs"
    max_upload_size_mb: int = 5

    # AI (Gemini)
    gemini_api_key: str = ""

    # CORS
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8081,http://localhost:8000,http://127.0.0.1:8000,*"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()

# Ensure uploads directory exists
os.makedirs(settings.upload_dir, exist_ok=True)

