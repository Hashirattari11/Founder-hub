"""Google Meet link creation via the Google Calendar API.

This is fully optional: when OAuth credentials are not configured (the
default), every call returns None and the app falls back to the built-in
FounderHub video room link. No credentials are shipped in the repo.
"""
import logging

from app.core.config import settings

logger = logging.getLogger("founderhub.google_meet")


def google_meet_configured() -> bool:
    return bool(settings.google_client_id and settings.google_client_secret)


def create_google_meet_link(summary: str, starts_at: str, ends_at: str, attendee_emails: list[str]) -> str | None:
    """Create a Google Meet event and return its hangout link.

    Returns None when Google OAuth is not configured, the library is not
    installed, or anything fails — callers must fall back to the built-in room.
    """
    if not google_meet_configured():
        logger.info("Google OAuth not configured — skipping Google Meet link")
        return None

    try:
        from google.oauth2.credentials import Credentials
        from googleapiclient.discovery import build

        # OAuth flow must be completed by an admin before this is used.
        # For now treat missing tokens as "not configured".
        raise RuntimeError("Google Meet OAuth token not configured")
    except Exception as exc:  # pragma: no cover
        logger.warning("Google Meet link creation skipped: %s", exc)
        return None
