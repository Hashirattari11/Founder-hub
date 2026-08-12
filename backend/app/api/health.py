from fastapi import APIRouter, Header, HTTPException

from app.core.config import settings
from app.services.email_queue_service import drain_pending

router = APIRouter()


@router.get("/health")
async def health_check():
    return {"status": "ok", "service": "FounderHub API"}


@router.get("/api/cron/drain-emails")
async def cron_drain_emails(authorization: str | None = Header(default=None)):
    """Vercel cron — flush queued emails (including delayed message batch)."""
    secret = settings.cron_secret or settings.brevo_webhook_secret
    if secret:
        token = (authorization or "").removeprefix("Bearer ").strip()
        if token != secret:
            raise HTTPException(status_code=401, detail="Unauthorized")
    sent = drain_pending()
    return {"ok": True, "processed": sent}
