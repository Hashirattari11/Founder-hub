"""Reusable, branded HTML email templates for FounderHub.

Every template returns the full HTML document (dark, responsive, inline CSS)
so it can be sent as-is through any provider (Brevo / Resend).
"""
import html
from datetime import datetime
from typing import Dict, Optional

from app.core.config import settings

FRONTEND_URL = settings.frontend_url


def _esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""))


def _fmt_dt(value: Optional[str]) -> str:
    if not value:
        return ""
    try:
        dt = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return dt.astimezone().strftime("%b %d, %Y at %I:%M %p")
    except Exception:
        return _esc(value)


def _shell(inner: str, footer: str = "", preheader: str = "") -> str:
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  {f'<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">{_esc(preheader)}</div>' if preheader else ""}
</head>
<body style="margin:0;padding:0;background:#0F0F0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;-webkit-text-size-adjust:100%;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F0F;">
    <tr>
      <td align="center" style="padding:32px 16px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#1A1A1A;border-radius:16px;border:1px solid #2A2A2A;overflow:hidden;">
          <tr>
            <td style="padding:28px 32px 0;">
              <span style="color:#7C3AED;font-size:22px;font-weight:800;letter-spacing:-0.5px;">FounderHub AI</span>
            </td>
          </tr>
          <tr>
            <td style="padding:8px 32px 32px;">
              {inner}
            </td>
          </tr>
          {f'<tr><td style="padding:20px 32px;border-top:1px solid #2A2A2A;"><p style="color:#4B5563;font-size:12px;line-height:1.6;margin:0;text-align:center;">{footer}</p></td></tr>' if footer else ""}
        </table>
        <p style="color:#4B5563;font-size:11px;margin:16px 0 0;text-align:center;">© {datetime.utcnow().year} FounderHub AI · <a href="{FRONTEND_URL}" style="color:#6B7280;text-decoration:none;">FounderHub</a></p>
      </td>
    </tr>
  </table>
</body>
</html>"""


def _badge(color: str, text: str) -> str:
    return f"""<span style="display:inline-block;background:{color}1f;border:1px solid {color}40;border-radius:8px;padding:6px 14px;font-size:13px;font-weight:600;color:{color};">{_esc(text)}</span>"""


def _cta(href: str, label: str, secondary: bool = False) -> str:
    style = (
        "background:#1F1F1F;border:1px solid #3A3A3A;color:#D1D5DB;"
        if secondary
        else "background:#7C3AED;color:#FFFFFF;"
    )
    return f"""<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 8px 0 0;display:inline-table;">
      <tr><td>
        <a href="{_esc(href)}" style="display:inline-block;{style}text-decoration:none;padding:13px 24px;border-radius:10px;font-weight:600;font-size:15px;">{_esc(label)}</a>
      </td></tr>
    </table>"""


def _heading(text: str, size: str = "22px") -> str:
    return f"""<h1 style="color:#FFFFFF;font-size:{size};font-weight:700;margin:16px 0 8px;letter-spacing:-0.3px;">{_esc(text)}</h1>"""


def _text(body: str, color: str = "#9CA3AF", size: str = "15px") -> str:
    return f"""<p style="color:{color};font-size:{size};line-height:1.65;margin:0 0 24px;">{body}</p>"""


def _card(inner: str) -> str:
    return f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:12px;margin:0 0 24px;"><tr><td style="padding:20px;">{inner}</td></tr></table>"""


def _kv(label: str, value: str) -> str:
    return f"""<tr><td style="padding:6px 0;color:#6B7280;font-size:13px;white-space:nowrap;vertical-align:top;">{_esc(label)}</td><td style="padding:6px 12px;color:#E5E7EB;font-size:14px;">{value}</td></tr>"""


def render_template(template: str, data: Optional[Dict] = None) -> Dict[str, str]:
    """Render a named template to {subject, html, text}.

    `data` may include: user_name, startup_name, investor_name, role,
    company, meeting_time, action_url, status, match_score, etc.
    """
    data = data or {}
    return _RENDERERS[template](data)


# ---------------------------------------------------------------------------
# Individual templates
# ---------------------------------------------------------------------------

def _welcome(d: Dict) -> Dict[str, str]:
    name = d.get("user_name", "there")
    url = d.get("action_url") or f"{FRONTEND_URL}/login"
    inner = (
        _heading(f"Welcome to FounderHub{', ' + name if name and name != 'there' else ''} 👋")
        + _text("You're all set. From idea to funded startup — co-founders, developers, investors and AI tools in one place.")
        + _cta(url, "Explore FounderHub")
    )
    return {"subject": "Welcome to FounderHub AI", "html": _shell(inner, "You received this because you created an account.")}


def _verify_email(d: Dict) -> Dict[str, str]:
    url = d.get("action_url") or f"{FRONTEND_URL}/login"
    inner = (
        _heading("Verify your email address")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, please confirm your email to activate your FounderHub account.")
        + _cta(url, "Verify Email")
    )
    return {"subject": "Verify your email — FounderHub AI", "html": _shell(inner, "If you didn't create an account, ignore this email.")}


def _password_reset(d: Dict) -> Dict[str, str]:
    url = d.get("action_url") or f"{FRONTEND_URL}/forgot-password"
    inner = (
        _heading("Reset your password")
        + _text("Click the button below to set a new password. This link expires in 30 minutes.")
        + _cta(url, "Reset Password")
    )
    return {"subject": "Reset your password — FounderHub AI", "html": _shell(inner, "If you didn't request this, you can safely ignore it.")}


def _meeting_invite(d: Dict) -> Dict[str, str]:
    title = d.get("meeting_title") or d.get("meeting_name") or "Meeting"
    time = _fmt_dt(d.get("meeting_time") or d.get("scheduled_at"))
    with_ = d.get("investor_name") or d.get("other_name") or "your contact"
    link = d.get("action_url") or d.get("meet_link") or f"{FRONTEND_URL}/meetings"
    inner = (
        _badge("#A78BFA", "New meeting invite")
        + _heading(f"{title} with {_esc(with_)}")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, a meeting has been scheduled. Please review the details and join at the scheduled time.")
        + _card(f"""<table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="color:#FFFFFF;font-size:17px;font-weight:600;padding:0 0 8px;">{_esc(title)}</td></tr>
          <tr><td>{_text(f"<strong style='color:#FFFFFF;'>{_esc(with_)}</strong> · {time}", "#D1D5DB", "14px")}</td></tr>
        </table>""")
        + _cta(link, "View Meeting")
    )
    return {"subject": f"Meeting invite: {title}", "html": _shell(inner, "Add it to your calendar so you don't miss it.")}


def _meeting_reminder(d: Dict) -> Dict[str, str]:
    title = d.get("meeting_title") or d.get("meeting_name") or "Meeting"
    time = _fmt_dt(d.get("meeting_time") or d.get("scheduled_at"))
    link = d.get("action_url") or d.get("meet_link") or f"{FRONTEND_URL}/meetings"
    inner = (
        _badge("#F59E0B", "Starts soon")
        + _heading(f"Reminder: {title}")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, your meeting is at {time}. Tap below to join on time.")
        + _cta(link, "Join Meeting")
    )
    return {"subject": f"Reminder: {title} starts soon", "html": _shell(inner, "Automated reminder from FounderHub AI.")}


def _meeting_cancelled(d: Dict) -> Dict[str, str]:
    title = d.get("meeting_title") or d.get("meeting_name") or "Meeting"
    inner = (
        _badge("#EF4444", "Cancelled")
        + _heading(f"{title} was cancelled")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, the meeting was cancelled. Reschedule anytime from your meetings page.")
        + _cta(f"{FRONTEND_URL}/meetings", "View Meetings", secondary=True)
    )
    return {"subject": f"Meeting cancelled: {title}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _application_accepted(d: Dict) -> Dict[str, str]:
    startup = d.get("startup_name", "the startup")
    role = d.get("role", "")
    url = d.get("action_url") or f"{FRONTEND_URL}/dashboard"
    inner = (
        _badge("#34D399", "Accepted 🎉")
        + _heading(f"You're in at {_esc(startup)}!")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, your application{f' for {_esc(role)}' if role else ''} at <strong style='color:#FFFFFF;'>{_esc(startup)}</strong> was accepted. Let's build!")
        + _cta(url, "View Application")
    )
    return {"subject": f"Application accepted — {startup}", "html": _shell(inner, "Congrats from the FounderHub team.")}


def _application_rejected(d: Dict) -> Dict[str, str]:
    startup = d.get("startup_name", "the startup")
    role = d.get("role", "")
    inner = (
        _badge("#EF4444", "Not this time")
        + _heading("Application update")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, the team at <strong style='color:#FFFFFF;'>{_esc(startup)}</strong>{f' reviewed your {_esc(role)} application' if role else ''} and decided to move forward with other candidates. Keep going — the right match is out there.")
        + _cta(f"{FRONTEND_URL}/startups", "Explore More Startups", secondary=True)
    )
    return {"subject": f"Application update — {startup}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _application_shortlisted(d: Dict) -> Dict[str, str]:
    startup = d.get("startup_name", "the startup")
    role = d.get("role", "")
    url = d.get("action_url") or f"{FRONTEND_URL}/dashboard"
    inner = (
        _badge("#F59E0B", "Shortlisted ⭐")
        + _heading(f"Great news from {_esc(startup)}")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, the team at <strong style='color:#FFFFFF;'>{_esc(startup)}</strong> shortlisted your application{f' for {_esc(role)}' if role else ''}. They'll be in touch — keep an eye on your inbox.")
        + _cta(url, "View Application")
    )
    return {"subject": f"You're shortlisted at {startup} 🎉", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _startup_match(d: Dict) -> Dict[str, str]:
    startup = d.get("startup_name", "A startup")
    industry = d.get("industry") or ""
    match_score = d.get("match_score")
    role = d.get("role")
    url = d.get("action_url") or f"{FRONTEND_URL}/startups"
    badge = f"{match_score}% match" if match_score is not None else "New match"
    intro = (
        f"looking for a <strong style='color:#FFFFFF;'>{_esc(role)}</strong>"
        if role
        else f"building in <strong style='color:#FFFFFF;'>{_esc(industry)}</strong>"
    )
    inner = (
        _badge("#A78BFA", _esc(badge))
        + _heading(f"{_esc(startup)} needs you")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, a startup is {intro}. Based on your skills and profile, this could be a strong fit.")
        + _cta(url, "View Startup")
    )
    return {"subject": f"{startup} is looking for your skills", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _cofounder_request(d: Dict) -> Dict[str, str]:
    requester = d.get("from_name", "Someone")
    match_score = d.get("match_score")
    message = d.get("message")
    url = d.get("action_url") or f"{FRONTEND_URL}/co-founder"
    score_badge = _badge("#A78BFA", f"{match_score}% co-founder match") if match_score is not None else ""
    msg_block = (
        _card(_text(f"&ldquo;{_esc(message)}&rdquo;", "#D1D5DB", "14px")) if message else ""
    )
    inner = (
        score_badge
        + _heading(f"{_esc(requester)} wants to co-found with you")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, a {match_score}% match wants to build together.")
        + msg_block
        + _cta(url, "Review & Respond")
    )
    return {"subject": f"🤝 {requester} wants to co-found with you — {match_score}% match", "html": _shell(inner, "Respond from your FounderHub co-founder hub.")}


def _cofounder_accepted(d: Dict) -> Dict[str, str]:
    accepter = d.get("from_name", "Someone")
    url = d.get("action_url") or f"{FRONTEND_URL}/co-founder"
    inner = (
        _badge("#34D399", "Accepted 🎉")
        + _heading(f"{_esc(accepter)} accepted your co-founder request")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, you're now connected — go say hi and start building together.")
        + _cta(url, "Open Co-Founder Hub")
    )
    return {"subject": f"🎉 {accepter} accepted your co-founder request", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _investor_interested(d: Dict) -> Dict[str, str]:
    investor = d.get("investor_name", "An investor")
    startup = d.get("startup_name", "your startup")
    url = d.get("action_url") or f"{FRONTEND_URL}/dashboard"
    inner = (
        _badge("#34D399", "Interested 💜")
        + _heading(f"{_esc(investor)} is interested in {_esc(startup)}")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, an investor wants to learn more about <strong style='color:#FFFFFF;'>{_esc(startup)}</strong>.")
        + _cta(url, "Respond Now")
    )
    return {"subject": f"{investor} is interested in {startup}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _data_room_viewed(d: Dict) -> Dict[str, str]:
    viewer = d.get("from_name", "Someone")
    document = d.get("document_name", "a document")
    inner = (
        _badge("#60A5FA", "Document Viewed")
        + _heading(f"{_esc(viewer)} viewed your document")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, someone reviewed <strong style='color:#FFFFFF;'>{_esc(document)}</strong> in your data room.")
    )
    return {"subject": f"{viewer} viewed your {document}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _data_room_access_requested(d: Dict) -> Dict[str, str]:
    requester = d.get("from_name", "Someone")
    startup = d.get("startup_name", "your startup")
    url = d.get("action_url") or f"{FRONTEND_URL}/dashboard"
    inner = (
        _badge("#A78BFA", "Access Request")
        + _heading(f"{_esc(requester)} requested access to your data room")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, an investor wants to review the <strong style='color:#FFFFFF;'>{_esc(startup)}</strong> data room.")
        + _cta(url, "Review Access Request")
    )
    return {"subject": f"{requester} requested access to your data room", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _job_application(d: Dict) -> Dict[str, str]:
    role = d.get("job_title") or "the role"
    startup = d.get("startup_name") or ""
    applicant = d.get("from_name") or "A new candidate"
    status = d.get("status")
    url = d.get("action_url") or f"{FRONTEND_URL}/jobs"
    if status:
        inner = (
            _badge("#3B82F6", "Application update")
            + _heading(f"Your application for {_esc(role)} is {status}")
            + _text(f"Hi {_esc(d.get('user_name', 'there'))}, your application for <strong style='color:#FFFFFF;'>{_esc(role)}</strong> is now <strong style='color:#FFFFFF;'>{status}</strong>.")
            + _cta(url, "Track Application")
        )
        return {"subject": f"Your application for {role} was {status}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}
    if startup:
        inner = (
            _badge("#3B82F6", "New job for you")
            + _heading(f"{_esc(startup)} is hiring a {_esc(role)}")
            + _text(f"Hi {_esc(d.get('user_name', 'there'))}, your skills look like a fit for the {_esc(role)} role at <strong style='color:#FFFFFF;'>{_esc(startup)}</strong>.")
            + _cta(url, "View Job")
        )
        return {"subject": f"New job for you: {role} at {startup}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}
    inner = (
        _badge("#3B82F6", "New application")
        + _heading(f"{_esc(applicant)} applied for {_esc(role)}")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, <strong style='color:#FFFFFF;'>{_esc(applicant)}</strong> applied for <strong style='color:#FFFFFF;'>{_esc(role)}</strong>{f' at {_esc(startup)}' if startup else ''}.")
        + _cta(url, "Review Applications")
    )
    return {"subject": f"New application: {applicant} for {role}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _investor_match(d: Dict) -> Dict[str, str]:
    startup = d.get("startup_name", "your startup")
    match_score = d.get("match_score")
    reasons = d.get("reasons") or []
    url = d.get("action_url") or f"{FRONTEND_URL}/investor/dashboard"
    reasons_html = "".join(
        f'<li style="color:#D1D5DB;font-size:14px;margin-bottom:6px;">✓ {_esc(r)}</li>' for r in reasons
    )
    inner = (
        _badge("#A78BFA", f"AI Match Score: {match_score}%")
        + _heading("A startup matches your thesis")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, a founder reached out about <strong style='color:#FFFFFF;'>{_esc(startup)}</strong>.")
        + (f'<ul style="margin:0 0 24px;padding-left:20px;">{reasons_html}</ul>' if reasons_html else "")
        + _cta(url, "View Startup")
    )
    return {"subject": f"🚀 A startup matches {match_score}% with your thesis — {startup}", "html": _shell(inner, "Respond from your FounderHub investor dashboard.")}


def _data_room_access_approved(d: Dict) -> Dict[str, str]:
    startup = d.get("startup_name", "this startup")
    url = d.get("action_url") or f"{FRONTEND_URL}/dashboard"
    inner = (
        _badge("#34D399", "Access Granted")
        + _heading(f"You have access to {_esc(startup)}")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, you have been granted access to the {_esc(startup)} data room.")
        + _cta(url, "Open Data Room")
    )
    return {"subject": f"You have been granted access to {startup} data room", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _startup_approved(d: Dict) -> Dict[str, str]:
    startup = d.get("startup_name", "your startup")
    url = d.get("action_url") or f"{FRONTEND_URL}/dashboard"
    inner = (
        _badge("#34D399", "Approved ✅")
        + _heading(f"{_esc(startup)} is live!")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, your startup <strong style='color:#FFFFFF;'>{_esc(startup)}</strong> was approved and published. Founders, devs and investors can now find you.")
        + _cta(url, "View Startup")
    )
    return {"subject": f"{startup} approved & published", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _role_approved(d: Dict) -> Dict[str, str]:
    role = d.get("role", "the role")
    inner = (
        _badge("#34D399", "Role updated")
        + _heading(f"You're now a {_esc(role)}")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, your role request was approved. New features are unlocked for you.")
        + _cta(f"{FRONTEND_URL}/dashboard", "Go to Dashboard")
    )
    return {"subject": f"Role approved: {role}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _role_rejected(d: Dict) -> Dict[str, str]:
    role = d.get("role", "the role")
    inner = (
        _badge("#EF4444", "Role request update")
        + _heading("Role request not approved")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, your request for the <strong style='color:#FFFFFF;'>{_esc(role)}</strong> role wasn't approved at this time. You can request again later.")
        + _cta(f"{FRONTEND_URL}/profile", "Edit Profile", secondary=True)
    )
    return {"subject": "Role request update — FounderHub", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _admin_alert(d: Dict) -> Dict[str, str]:
    inner = (
        _heading(d.get("title", "System alert"))
        + _text(d.get("body", "An event requires admin attention."))
    )
    return {"subject": d.get("title", "FounderHub Admin Alert"), "html": _shell(inner, "Sent to admin from FounderHub AI.")}


def _broadcast(d: Dict) -> Dict[str, str]:
    inner = (
        _heading(d.get("title", "FounderHub news"))
        + _text(d.get("body", ""))
        + _cta(d.get("action_url") or FRONTEND_URL, d.get("action_label", "Learn More"))
    )
    return {"subject": d.get("subject", d.get("title", "FounderHub news")), "html": _shell(inner, "You received this because it matches your preferences.")}


def _startup_new(d: Dict) -> Dict[str, str]:
    name = d.get("startup_name") or d.get("title") or "A new startup"
    tagline = d.get("tagline") or ""
    industry = d.get("industry") or ""
    sector = f" in <strong style='color:#FFFFFF;'>{_esc(industry)}</strong>" if industry else ""
    url = d.get("action_url") or f"{FRONTEND_URL}/startups"
    inner = (
        _badge("#8B5CF6", "New on FounderHub")
        + _heading(_esc(name))
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, a new startup{sector} just launched on FounderHub." + (f"<br><span style='color:#9CA3AF;'>“{_esc(tagline)}”</span>" if tagline else ""))
        + _cta(url, "View Startup")
    )
    return {"subject": f"{name} just launched on FounderHub", "html": _shell(inner, "You received this because it matches your preferences.")}


def _meeting_rescheduled(d: Dict) -> Dict[str, str]:
    title = d.get("meeting_title") or d.get("meeting_name") or "Meeting"
    time = _fmt_dt(d.get("meeting_time") or d.get("scheduled_at"))
    with_ = d.get("investor_name") or d.get("other_name") or "your contact"
    inner = (
        _badge("#3B82F6", "Rescheduled")
        + _heading(f"{title} was rescheduled")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, your meeting with <strong style='color:#FFFFFF;'>{_esc(with_)}</strong> moved to {time}.")
        + _cta(f"{FRONTEND_URL}/meetings", "View Meetings")
    )
    return {"subject": f"Rescheduled: {title}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _meeting_accepted(d: Dict) -> Dict[str, str]:
    title = d.get("meeting_title") or d.get("meeting_name") or "Meeting"
    time = _fmt_dt(d.get("meeting_time") or d.get("scheduled_at"))
    inner = (
        _badge("#34D399", "Confirmed ✅")
        + _heading(f"{title} is confirmed")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, the meeting is confirmed for {time}.")
        + _cta(d.get("action_url") or f"{FRONTEND_URL}/meetings", "View Meeting")
    )
    return {"subject": f"Confirmed: {title}", "html": _shell(inner, "This is an automated email from FounderHub AI.")}


def _message_received(d: Dict) -> Dict[str, str]:
    from_ = d.get("from_name", "Someone")
    url = d.get("action_url") or f"{FRONTEND_URL}/messages"
    label = d.get("action_label") or "Open Chat"
    inner = (
        _heading("You have a new message")
        + _text(f"Hi {_esc(d.get('user_name', 'there'))}, <strong style='color:#FFFFFF;'>{_esc(from_)}</strong> sent you a message.")
        + _cta(url, label)
    )
    return {"subject": f"New message from {from_} — FounderHub", "html": _shell(inner, "You can change message emails in your preferences.")}


_RENDERERS = {
    "welcome": _welcome,
    "verify_email": _verify_email,
    "password_reset": _password_reset,
    "meeting_invite": _meeting_invite,
    "meeting_reminder": _meeting_reminder,
    "meeting_cancelled": _meeting_cancelled,
    "meeting_rescheduled": _meeting_rescheduled,
    "meeting_accepted": _meeting_accepted,
    "application_accepted": _application_accepted,
    "application_rejected": _application_rejected,
    "application_shortlisted": _application_shortlisted,
    "startup_match": _startup_match,
    "cofounder_request": _cofounder_request,
    "cofounder_accepted": _cofounder_accepted,
    "data_room_viewed": _data_room_viewed,
    "data_room_access_requested": _data_room_access_requested,
    "data_room_access_approved": _data_room_access_approved,
    "investor_interested": _investor_interested,
    "investor_match": _investor_match,
    "job_application": _job_application,
    "startup_approved": _startup_approved,
    "role_approved": _role_approved,
    "role_rejected": _role_rejected,
    "admin_alert": _admin_alert,
    "broadcast": _broadcast,
    "startup_new": _startup_new,
    "message_received": _message_received,
}

TEMPLATE_NAMES = sorted(_RENDERERS.keys())
