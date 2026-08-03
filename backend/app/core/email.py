import logging
from typing import Optional

from app.core.config import settings

logger = logging.getLogger("founderhub.email")


def send_email(to: str, subject: str, html: str) -> bool:
    """Send a transactional email via Resend. Never raises — logs failures.

    Returns True when the email was accepted by Resend.
    """
    if not settings.resend_api_key:
        logger.warning("RESEND_API_KEY not set — skipping email to %s", to)
        return False

    try:
        import resend

        resend.api_key = settings.resend_api_key
        resend.Emails.send(
            {
                "from": settings.resend_from_email,
                "to": [to],
                "subject": subject,
                "html": html,
            }
        )
        return True
    except Exception as exc:  # pragma: no cover
        logger.warning("Resend failed for %s: %s", to, exc)
        return False


def email_for_status_update(to: str, name: str, startup_name: str, role: str, status: str) -> bool:
    status_label = status.capitalize()
    colors = {
        "accepted": "#22c55e",
        "shortlisted": "#3b82f6",
        "rejected": "#ef4444",
    }
    return send_email(
        to,
        f"Your application to {startup_name} was {status_label.lower()}",
        f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
          <h2 style="margin-bottom:4px">Hi {name},</h2>
          <p style="color:#6b7280;margin-top:0">Your application for <b>{role}</b> at <b>{startup_name}</b>
          has been <span style="color:{colors.get(status, '#111827')};font-weight:bold">{status_label}</span>.</p>
          <p style="color:#6b7280">— FounderHub AI</p>
        </div>
        """,
    )


def email_for_match(to: str, name: str, startup_name: str, role: str, score: int) -> bool:
    return send_email(
        to,
        f"New startup matches your skills: {startup_name}",
        f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
          <h2 style="margin-bottom:4px">Hi {name},</h2>
          <p style="color:#6b7280;margin-top:0"><b>{startup_name}</b> is looking for a <b>{role}</b>
          and it's a <b style="color:#7c3aed">{score}%</b> match with your profile.</p>
          <p style="color:#6b7280">Log in to FounderHub to apply.</p>
          <p style="color:#6b7280">— FounderHub AI</p>
        </div>
        """,
    )


def email_for_application(to: str, founder_name: str, startup_name: str, applicant_name: str, role: str) -> bool:
    return send_email(
        to,
        f"New application: {applicant_name} for {role}",
        f"""
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto">
          <h2 style="margin-bottom:4px">Hi {founder_name},</h2>
          <p style="color:#6b7280;margin-top:0"><b>{applicant_name}</b> applied for <b>{role}</b> at
          <b>{startup_name}</b>. Review it in your FounderHub dashboard.</p>
          <p style="color:#6b7280">— FounderHub AI</p>
        </div>
        """,
    )
