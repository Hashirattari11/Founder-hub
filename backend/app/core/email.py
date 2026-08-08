"""Transactional email transport.

Supports two providers behind one interface:
  * Brevo (SIB / Sendinblue) — `BREVO_API_KEY`
  * Resend — `RESEND_API_KEY`

Provider selection is `EMAIL_PROVIDER` (default "brevo"). Sending never
raises: failures are logged and reported via the return value / exception
list so the queue worker can decide whether to retry.
"""
import logging
from typing import List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger("founderhub.email")

BREVO_API = "https://api.brevo.com/v3/smtp/email"


def _from_headers() -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.brevo_api_key:
        headers["api-key"] = settings.brevo_api_key
    return headers


def _send_brevo(to: str, subject: str, html: str, text: str | None) -> None:
    if not settings.brevo_api_key:
        raise RuntimeError("BREVO_API_KEY not set")
    payload = {
        "sender": {
            "name": settings.email_from_name,
            "email": settings.email_from_email,
        },
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
    }
    if text:
        payload["textContent"] = text
    resp = httpx.post(BREVO_API, json=payload, headers=_from_headers(), timeout=30.0)
    if resp.status_code >= 400:
        raise RuntimeError(f"Brevo HTTP {resp.status_code}: {resp.text[:300]}")


def _send_resend(to: str, subject: str, html: str, text: str | None) -> None:
    if not settings.resend_api_key:
        raise RuntimeError("RESEND_API_KEY not set")
    import resend

    resend.api_key = settings.resend_api_key
    payload = {
        "from": settings.resend_from_email,
        "to": [to],
        "subject": subject,
        "html": html,
    }
    if text:
        payload["text"] = text
    resend.Emails.send(payload)


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    provider: str | None = None,
) -> bool:
    """Send a transactional email via the configured provider.

    Returns True when the provider accepted it. Never raises.
    """
    chosen = (provider or settings.email_provider or "brevo").lower()
    try:
        if chosen == "resend":
            _send_resend(to, subject, html, text)
        elif chosen == "brevo":
            _send_brevo(to, subject, html, text)
        else:
            logger.warning("Unknown email provider %r — skipping", chosen)
            return False
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("Email to %s failed via %s: %s", to, chosen, exc)
        return False


def send_email_ex(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    provider: str | None = None,
) -> Tuple[bool, Optional[str]]:
    """Like send_email but also returns the error message (for queue retry)."""
    chosen = (provider or settings.email_provider or "brevo").lower()
    try:
        if chosen == "resend":
            _send_resend(to, subject, html, text)
        elif chosen == "brevo":
            _send_brevo(to, subject, html, text)
        else:
            return False, f"Unknown email provider {chosen!r}"
        return True, None
    except Exception as exc:  # pragma: no cover
        logger.warning("Email to %s failed via %s: %s", to, chosen, exc)
        return False, str(exc)


def send_email_many(emails: List[dict]) -> int:
    """Send several emails; returns the count that succeeded. Best-effort."""
    sent = 0
    for item in emails:
        ok = send_email(
            item.get("to", ""),
            item.get("subject", ""),
            item.get("html", ""),
            item.get("text"),
        )
        if ok:
            sent += 1
    return sent


# ---------------------------------------------------------------------------
# Legacy convenience helpers (kept for existing callers)
# ---------------------------------------------------------------------------


def email_for_status_update(to: str, name: str, startup_name: str, role: str, status: str) -> bool:
    from app.services.email_templates import render_template

    rendered = render_template(
        "application_accepted" if status.lower() == "accepted" else "application_rejected",
        {"user_name": name, "startup_name": startup_name, "role": role},
    )
    return send_email(to, rendered["subject"], rendered["html"])


def email_for_match(to: str, name: str, startup_name: str, role: str, score: int) -> bool:
    from app.services.email_templates import render_template

    rendered = render_template(
        "investor_interested" if role.lower() == "investor" else "broadcast",
        {"user_name": name, "startup_name": startup_name, "role": role, "match_score": score},
    )
    return send_email(to, rendered["subject"], rendered["html"])


def email_for_application(to: str, founder_name: str, startup_name: str, applicant_name: str, role: str) -> bool:
    from app.services.email_templates import render_template

    rendered = render_template(
        "message_received",
        {"user_name": founder_name, "from_name": applicant_name, "startup_name": startup_name, "role": role},
    )
    return send_email(to, rendered["subject"], rendered["html"])
