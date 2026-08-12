"""Transactional email transport — Brevo primary, Resend fallback.

All FounderHub transactional email is delivered through Brevo
(`BREVO_API_KEY`). The Brevo `messageId` returned on acceptance is captured
so the webhook endpoint can map delivery events (delivered / opened /
clicked / bounced / blocked) back to queue + log rows.

If Brevo is not configured (or its key is rejected), delivery falls back to
Resend (`RESEND_API_KEY`) so email keeps flowing even when one provider is
misconfigured. Sending never raises: every attempt returns a structured
result {ok, error, message_id, http_status} so the queue worker can decide
whether to retry and the admin panel can surface real delivery status.
"""
import logging
from typing import Dict, List, Optional, Tuple

import httpx

from app.core.config import settings

logger = logging.getLogger("founderhub.email")

BREVO_API = "https://api.brevo.com/v3/smtp/email"


def resolve_email_provider() -> str | None:
    """Resolve the effective provider based on config + available keys.

    "brevo" wins when a Brevo key exists; otherwise "resend" when a Resend
    key exists; otherwise None. The chosen provider is pinned on the queue
    row so the admin panel can see where each message was sent.
    """
    chosen = (settings.email_provider or "auto").lower()
    if chosen not in ("auto", "brevo", "resend"):
        logger.warning("Unknown EMAIL_PROVIDER %r — falling back to auto", chosen)
        chosen = "auto"
    if chosen == "brevo":
        return "brevo" if settings.brevo_api_key else None
    if chosen == "resend":
        return "resend" if settings.resend_api_key else None
    # auto: prefer Resend when both keys exist (Brevo IP whitelist often blocks Vercel).
    if settings.resend_api_key:
        return "resend"
    if settings.brevo_api_key:
        return "brevo"
    return None


def _headers() -> dict:
    headers = {"Content-Type": "application/json", "Accept": "application/json"}
    if settings.brevo_api_key:
        headers["api-key"] = settings.brevo_api_key
    return headers


def send_brevo_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    *,
    from_name: str | None = None,
    from_email: str | None = None,
) -> dict:
    """Send one transactional email via Brevo and return a structured result.

    Returns:
      {"ok": bool, "error": str|None, "message_id": str|None,
       "http_status": int|None}
    """
    if not settings.brevo_api_key:
        return {"ok": False, "error": "BREVO_API_KEY not set", "message_id": None, "http_status": None}
    if not to:
        return {"ok": False, "error": "Missing recipient", "message_id": None, "http_status": None}
    payload = {
        "sender": {
            "name": from_name or settings.email_from_name,
            "email": from_email or settings.email_from_email,
        },
        "to": [{"email": to}],
        "subject": subject,
        "htmlContent": html,
    }
    if text:
        payload["textContent"] = text
    try:
        resp = httpx.post(BREVO_API, json=payload, headers=_headers(), timeout=30.0)
    except httpx.HTTPError as exc:
        logger.warning("Brevo network error sending to %s: %s", to, exc)
        return {"ok": False, "error": f"Brevo network error: {exc}", "message_id": None, "http_status": None}
    if resp.status_code >= 400:
        logger.warning("Brevo HTTP %s sending to %s: %s", resp.status_code, to, resp.text[:300])
        return {
            "ok": False,
            "error": f"Brevo HTTP {resp.status_code}: {resp.text[:300]}",
            "message_id": None,
            "http_status": resp.status_code,
        }
    message_id = None
    try:
        message_id = resp.json().get("messageId")
    except Exception:
        message_id = None
    return {"ok": True, "error": None, "message_id": message_id, "http_status": resp.status_code}


def send_resend_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
) -> dict:
    """Send one transactional email via Resend and return a structured result.

    Returns the same {ok, error, message_id, http_status} shape as
    send_brevo_email so callers can treat both providers identically.
    """
    if not settings.resend_api_key:
        return {"ok": False, "error": "RESEND_API_KEY not set", "message_id": None, "http_status": None}
    if not to:
        return {"ok": False, "error": "Missing recipient", "message_id": None, "http_status": None}
    try:
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
        resp = resend.Emails.send(payload)
        message_id = None
        if isinstance(resp, dict):
            message_id = resp.get("id")
        elif isinstance(resp, str):
            message_id = resp
        return {"ok": True, "error": None, "message_id": message_id, "http_status": 200}
    except Exception as exc:  # pragma: no cover
        logger.warning("Resend failed for %s: %s", to, exc)
        return {"ok": False, "error": f"Resend error: {exc}", "message_id": None, "http_status": None}


def _send_with_fallback(
    to: str,
    subject: str,
    html: str,
    text: str | None,
    provider: str | None,
) -> dict:
    """Route a send through the requested provider, falling back to the other.

    Brevo is attempted first when a Brevo key exists; if it rejects the
    message (4xx/5xx/network) and a Resend key exists, Resend is tried so a
    bad Brevo key never silently kills delivery.
    """
    requested = (provider or resolve_email_provider() or "none").lower()
    result = None

    if requested == "brevo":
        result = send_brevo_email(to, subject, html, text)
        if not result["ok"] and settings.resend_api_key:
            logger.warning("Brevo failed (%s) — falling back to Resend for %s", result["error"], to)
            fallback = send_resend_email(to, subject, html, text)
            if fallback["ok"]:
                fallback["provider"] = "resend"
                return fallback
    elif requested == "resend":
        result = send_resend_email(to, subject, html, text)
        if not result["ok"] and settings.brevo_api_key:
            logger.warning("Resend failed (%s) — falling back to Brevo for %s", result["error"], to)
            fallback = send_brevo_email(to, subject, html, text)
            if fallback["ok"]:
                fallback["provider"] = "brevo"
                return fallback
    else:
        return {"ok": False, "error": "No email provider configured (missing BREVO_API_KEY / RESEND_API_KEY)", "message_id": None, "http_status": None, "provider": None}

    if result and result.get("ok"):
        result["provider"] = requested
    elif result:
        result["provider"] = requested
    return result or {"ok": False, "error": "Unknown provider error", "message_id": None, "http_status": None, "provider": requested}


def send_email(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    provider: str | None = None,
) -> bool:
    """Send a transactional email. Returns True when a provider accepted it.

    Never raises.
    """
    return _send_with_fallback(to, subject, html, text, provider)["ok"]


def send_email_ex(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    provider: str | None = None,
) -> Tuple[bool, Optional[str]]:
    """Like send_email but also returns the error message (for queue retry)."""
    result = _send_with_fallback(to, subject, html, text, provider)
    return result["ok"], result["error"]


def send_email_full(
    to: str,
    subject: str,
    html: str,
    text: str | None = None,
    provider: str | None = None,
) -> dict:
    """Send and return the full structured result (message_id, http_status)."""
    return _send_with_fallback(to, subject, html, text, provider)


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
