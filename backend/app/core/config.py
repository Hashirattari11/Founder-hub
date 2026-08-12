from pydantic_settings import BaseSettings
from dotenv import load_dotenv

load_dotenv()


class Settings(BaseSettings):
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    brevo_api_key: str = ""
    resend_api_key: str = ""
    # Primary provider is Brevo; Resend is kept as an automatic fallback so a
    # missing/invalid Brevo key never silently kills delivery. In "auto" the
    # first provider with a configured key wins (brevo → resend).
    email_provider: str = "brevo"
    email_from_name: str = "FounderHub"
    email_from_email: str = "notification@founderhub.site"
    resend_from_email: str = "FounderHub <notification@founderhub.site>"
    # Shared secret used to verify Brevo webhook signatures (HMAC-SHA256).
    brevo_webhook_secret: str = ""
    cron_secret: str = ""
    anthropic_api_key: str = ""
    encryption_key: str = ""
    frontend_url: str = "http://localhost:5173"
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = ""
    allowed_origins: str = (
        "http://localhost:5173,http://localhost:5174,http://localhost:3000,"
        "http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:3000,"
        "https://founder-hub-0.vercel.app"
    )
    # Super Admin bootstrap — populated from env, never logged or exposed.
    super_admin_email: str = ""
    super_admin_password: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.allowed_origins.split(",") if o.strip()]

    def frontend_url_for(self, path: str = "") -> str:
        base = (self.frontend_url or "https://founder-hub-0.vercel.app").rstrip("/")
        if path and not path.startswith("/"):
            path = f"/{path}"
        return f"{base}{path}"

    class Config:
        env_file = ".env"


settings = Settings()
