"""Settings read from environment variables (or api/.env locally). Secrets never live in code."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    version: str = "0.1.0"
    # Comma-separated list, e.g. "http://localhost:3000,https://fund-xray.vercel.app"
    web_origin: str = "http://localhost:3000"

    # Day 3: Supabase. The URL is enough to check sign-in tokens (public signing keys).
    supabase_url: str | None = None  # e.g. https://dgjbladcfysjncciukhg.supabase.co
    # Public key (sb_publishable_...). The API calls Supabase as the signed-in user, so row-level
    # security applies and no secret key is needed.
    supabase_publishable_key: str | None = None

    # Day 4: Kite Connect
    kite_api_key: str | None = None
    kite_api_secret: str | None = None
    # Informational: Kite uses the redirect URL registered on the Kite app, which must be the
    # web app's /kite/callback (e.g. https://fund-xray-theta.vercel.app/kite/callback).
    kite_redirect_url: str | None = None
    token_encryption_key: str | None = None  # Fernet key for Kite access tokens
    # Kite addresses; only changed to point tests at a stand-in
    kite_api_url: str = "https://api.kite.trade"
    kite_login_url: str = "https://kite.zerodha.com/connect/login"

    @property
    def web_origins(self) -> list[str]:
        return [o.strip() for o in self.web_origin.split(",") if o.strip()]

    @property
    def supabase_issuer(self) -> str | None:
        return f"{self.supabase_url.rstrip('/')}/auth/v1" if self.supabase_url else None

    @property
    def supabase_jwks_url(self) -> str | None:
        return f"{self.supabase_issuer}/.well-known/jwks.json" if self.supabase_issuer else None


settings = Settings()
