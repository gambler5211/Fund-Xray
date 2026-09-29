"""Settings read from environment variables (or api/.env locally). Secrets never live in code."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    version: str = "0.1.0"
    # Comma-separated list, e.g. "http://localhost:3000,https://fund-xray.vercel.app"
    web_origin: str = "http://localhost:3000"

    # Filled in on later days; unused on Day 1.
    kite_api_key: str | None = None
    kite_api_secret: str | None = None
    kite_redirect_url: str = "http://localhost:8000/kite/callback"
    supabase_url: str | None = None
    supabase_service_role_key: str | None = None
    supabase_jwt_secret: str | None = None
    token_encryption_key: str | None = None  # Fernet key for Kite access tokens

    @property
    def web_origins(self) -> list[str]:
        return [o.strip() for o in self.web_origin.split(",") if o.strip()]


settings = Settings()
