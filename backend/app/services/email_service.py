"""Rich HTML email templates used by the smart-notification pipeline.

Templates here build on the transport layer in `app.core.email` (Brevo).
"""
import html
from typing import Dict

from app.core.config import settings
from app.core.email import send_email

FRONTEND_URL = settings.frontend_url


def _esc(value: object) -> str:
    return html.escape(str(value if value is not None else ""))


def _shell(inner: str, footer: str) -> str:
    return f"""<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0F0F0F;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
    <div style="margin-bottom:32px;">
      <span style="color:#7C3AED;font-size:20px;font-weight:700;">FounderHub AI</span>
    </div>
    {inner}
    <p style="color:#4B5563;font-size:12px;text-align:center;margin-top:24px;">{footer}</p>
  </div>
</body>
</html>"""


def _badge(color: str, text: str) -> str:
    return f"""<span style="background:{color}20;border:1px solid {color}40;border-radius:8px;padding:6px 14px;display:inline-block;">
      <span style="color:{color};font-size:13px;font-weight:600;">{text}</span>
    </span>"""


def _startup_card(startup: Dict) -> str:
    industry = _esc(startup.get("industry") or "")
    stage = _esc((startup.get("stage") or "").upper())
    funding = _esc(startup.get("funding_needed") or 0)
    tagline = _esc(startup.get("tagline") or "")
    description = _esc((startup.get("description") or "")[:200])
    return f"""<div style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:12px;padding:20px;margin-bottom:24px;">
      <h2 style="color:#FFFFFF;font-size:18px;font-weight:600;margin:0 0 8px;">{_esc(startup.get('name', 'New Startup'))}</h2>
      <p style="color:#9CA3AF;font-size:14px;margin:0 0 16px;">{tagline}</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-bottom:16px;">
        <span style="background:#7C3AED20;color:#A78BFA;font-size:12px;padding:4px 10px;border-radius:6px;">{industry}</span>
        <span style="background:#0F6E5620;color:#34D399;font-size:12px;padding:4px 10px;border-radius:6px;">{stage}</span>
        <span style="background:#185FA520;color:#60A5FA;font-size:12px;padding:4px 10px;border-radius:6px;">Seeking: ${funding}</span>
      </div>
      <p style="color:#D1D5DB;font-size:14px;line-height:1.6;margin:0;">{description}</p>
    </div>"""


def _cta(href: str, label: str) -> str:
    return f"""<a href="{_esc(href)}" style="display:block;background:#7C3AED;color:#FFFFFF;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;font-size:15px;">
      {label}
    </a>"""


def _person_card(person: Dict, subtitle: str = "") -> str:
    name = _esc(person.get("full_name") or "Someone")
    role = _esc((person.get("role") or "").title())
    city = _esc(person.get("city") or "")
    bio = _esc((person.get("bio") or "")[:160])
    skills = ", ".join(_esc(s) for s in (person.get("skills") or [])[:6])
    subtitle_line = f'<p style="color:#A78BFA;font-size:13px;margin:0;">{_esc(subtitle)}</p>' if subtitle else ""
    return f"""<div style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:12px;padding:20px;margin-bottom:24px;">
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
        <div style="width:44px;height:44px;border-radius:50%;background:#7C3AED;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-weight:700;font-size:16px;">{_esc((person.get("full_name") or "U")[0].upper())}</div>
        <div>
          <p style="color:#FFFFFF;font-weight:600;font-size:16px;margin:0;">{name}</p>
          <p style="color:#9CA3AF;font-size:13px;margin:0;">{role}{f" · {city}" if city else ""}</p>
        </div>
      </div>
      {subtitle_line}
      {f'<p style="color:#D1D5DB;font-size:14px;line-height:1.6;margin:0 0 8px;">{bio}</p>' if bio else ""}
      {f'<p style="color:#6B7280;font-size:12px;margin:0;">SKILLS · {skills}</p>' if skills else ""}
    </div>"""


def send_investor_notification(investor_email: str, investor_name: str, startup: Dict, match_score: int) -> bool:
    startup_id = _esc(startup.get("id") or "")
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#A78BFA", f"AI Match Score: {match_score}%")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">New startup matches your interests</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(investor_name)}, a new startup in your investment area just launched.</p>
        {_startup_card(startup)}
        {_cta(f"{FRONTEND_URL}/startups/{startup_id}", "View Startup Details")}
      </div>"""
    return send_email(
        investor_email,
        f"🚀 New {_esc(startup.get('industry', ''))} startup matches your interests — {match_score}% match",
        _shell(inner, "You received this because your investment interests match this startup.<br>Manage preferences in your FounderHub settings."),
    )


def send_developer_notification(dev_email: str, dev_name: str, startup: Dict, match_score: int, role: str) -> bool:
    startup_id = _esc(startup.get("id") or "")
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#34D399", f"Skills Match: {match_score}%")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">A startup needs your skills</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(dev_name)}, {_esc(startup.get('name'))} is looking for a <strong style="color:#A78BFA;">{_esc(role)}</strong>.</p>
        {_startup_card(startup)}
        <div style="border-top:1px solid #2A2A2A;padding:16px 0;">
          <p style="color:#6B7280;font-size:12px;margin:0 0 8px;">OFFERING</p>
          <p style="color:#A78BFA;font-size:15px;font-weight:600;margin:0;">{_esc(startup.get('equity_offered', 0))}% equity</p>
        </div>
        {_cta(f"{FRONTEND_URL}/startups/{startup_id}", "View & Apply Now")}
      </div>"""
    return send_email(
        dev_email,
        f"💼 {_esc(startup.get('name'))} is looking for a {_esc(role)} — {match_score}% match",
        _shell(inner, "Manage your notification preferences in FounderHub settings."),
    )


def send_meeting_confirmation_email(
    to: str,
    name: str,
    meeting: Dict,
    other_name: str,
) -> bool:
    title = _esc(meeting.get("title") or "Meeting")
    scheduled = (meeting.get("scheduled_at") or "").replace("T", " ")[:16]
    meet_link = _esc(meeting.get("meet_link") or "")
    duration = meeting.get("duration_minutes") or 30
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 8px;">Meeting scheduled ✅</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(name)}, your meeting is confirmed.</p>
        <div style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:12px;padding:20px;margin-bottom:24px;">
          <p style="color:#FFFFFF;font-size:17px;font-weight:600;margin:0 0 4px;">{title}</p>
          <p style="color:#A78BFA;font-size:15px;margin:0 0 12px;">With {_esc(other_name)}</p>
          <p style="color:#D1D5DB;font-size:14px;margin:0 0 4px;">🕒 {scheduled} ({duration} min)</p>
        </div>
        {_cta(meet_link, "Join Video Call") if meet_link else '<p style="color:#9CA3AF;">Join from your FounderHub dashboard when it\'s time.</p>'}
      </div>"""
    return send_email(
        to,
        f"✅ Meeting confirmed: {title}",
        _shell(inner, "You can reschedule or cancel from your FounderHub meetings page."),
    )


def send_meeting_reminder_email(
    to: str,
    name: str,
    title: str,
    scheduled_at: str | None,
    meet_link: str,
    other_name: str,
) -> bool:
    scheduled = (scheduled_at or "").replace("T", " ")[:16]
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#F59E0B", "Starts soon")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">Reminder: {_esc(title)}</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(name)}, your meeting with <strong style="color:#FFFFFF;">{_esc(other_name)}</strong> starts at {scheduled}.</p>
        {_cta(_esc(meet_link), "Join Video Call") if meet_link else '<p style="color:#9CA3AF;">Open FounderHub to join.</p>'}
      </div>"""
    return send_email(
        to,
        f"⏰ Reminder: {_esc(title)} starts soon",
        _shell(inner, "This is an automated reminder from FounderHub AI."),
    )


def send_founder_application_email(founder_email: str, founder_name: str, applicant: Dict, startup_name: str, role: str) -> bool:
    applicant_name = _esc(applicant.get("full_name") or "Someone")
    initial = _esc((applicant.get("full_name") or "U")[0].upper())
    bio = _esc((applicant.get("bio") or "")[:150])
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:0 0 8px;">New application received</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(founder_name)}, someone applied to join <strong style="color:#FFFFFF;">{_esc(startup_name)}</strong>.</p>
        <div style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:12px;padding:20px;margin-bottom:24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <div style="width:44px;height:44px;border-radius:50%;background:#7C3AED;display:flex;align-items:center;justify-content:center;color:#FFFFFF;font-weight:700;font-size:16px;">{initial}</div>
            <div>
              <p style="color:#FFFFFF;font-weight:600;font-size:16px;margin:0;">{applicant_name}</p>
              <p style="color:#9CA3AF;font-size:13px;margin:0;">Applying for: {_esc(role)}</p>
            </div>
          </div>
          <p style="color:#D1D5DB;font-size:14px;line-height:1.6;margin:0;">{bio}</p>
        </div>
        {_cta(f"{FRONTEND_URL}/dashboard/applications", "Review Application")}
      </div>"""
    return send_email(
        founder_email,
        f"📬 New application for {_esc(startup_name)} — {applicant_name} applied",
        _shell(inner, ""),
    )


def send_cofounder_request_email(
    to_email: str,
    to_name: str,
    requester: Dict,
    match_score: int,
    message: str,
    profile_url: str,
) -> bool:
    """Email the target of a co-founder request (with Accept/Decline buttons)."""
    requester_name = _esc(requester.get("full_name") or "Someone")
    msg = _esc(message or "")
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#A78BFA", f"AI Match Score: {match_score}%")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">{requester_name} wants to co-found with you</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(to_name)}, a {match_score}% match wants to build together.</p>
        {_person_card(requester, f"{match_score}% co-founder match")}
        {f'<div style="background:#0F0F0F;border:1px solid #2A2A2A;border-radius:12px;padding:16px 20px;margin-bottom:24px;"><p style="color:#D1D5DB;font-size:14px;line-height:1.6;margin:0;">“{msg}”</p></div>' if msg else ""}
        <div style="display:flex;gap:10px;margin-bottom:24px;">
          <a href="{_esc(profile_url)}" style="flex:1;background:#7C3AED;color:#FFFFFF;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;font-size:15px;">Accept & Start Chat</a>
          <a href="{_esc(profile_url)}" style="flex:1;background:#1F1F1F;color:#9CA3AF;text-decoration:none;text-align:center;padding:14px;border-radius:10px;font-weight:600;font-size:15px;">View Profile</a>
        </div>
      </div>"""
    return send_email(
        to_email,
        f"🤝 {requester_name} wants to co-found with you — {match_score}% match",
        _shell(inner, "Respond from your FounderHub co-founder hub."),
    )


def send_cofounder_accepted_email(to_email: str, to_name: str, accepter: Dict, cofounder_url: str) -> bool:
    accepter_name = _esc(accepter.get("full_name") or "Someone")
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#34D399", "Accepted 🎉")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">{accepter_name} accepted your co-founder request</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">You're now connected — go say hi and start building together.</p>
        {_person_card(accepter, "Your new co-founder")}
        {_cta(cofounder_url, "Open Co-Founder Hub")}
      </div>"""
    return send_email(
        to_email,
        f"🎉 {accepter_name} accepted your co-founder request",
        _shell(inner, "This is an automated email from FounderHub AI."),
    )


def send_investor_match_email(
    to_email: str,
    to_name: str,
    startup: Dict,
    match_score: int,
    reasons: list,
    view_url: str,
) -> bool:
    reasons_html = "".join(
        f'<li style="color:#D1D5DB;font-size:14px;margin-bottom:6px;">✓ {_esc(r)}</li>' for r in (reasons or [])
    )
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#A78BFA", f"AI Match Score: {match_score}%")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">A startup matches your thesis</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(to_name)}, a founder reached out about <strong style="color:#FFFFFF;">{_esc(startup.get('name'))}</strong>.</p>
        {_startup_card(startup)}
        {f'<ul style="margin:0 0 24px;padding-left:20px;">{reasons_html}</ul>' if reasons_html else ""}
        {_cta(view_url, "View Startup")}
      </div>"""
    return send_email(
        to_email,
        f"🚀 A startup matches {match_score}% with your thesis — {_esc(startup.get('name'))}",
        _shell(inner, "Respond from your FounderHub investor dashboard."),
    )


def send_investor_interested_email(
    to_email: str,
    to_name: str,
    investor: Dict,
    startup_name: str,
    view_url: str,
) -> bool:
    investor_name = _esc(investor.get("full_name") or "An investor")
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#34D399", "Interested 💜")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">{investor_name} is interested in {_esc(startup_name)}</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(to_name)}, an investor wants to learn more about your startup.</p>
        {_person_card(investor, "Interested investor")}
        {_cta(view_url, "Book a Meeting")}
      </div>"""
    return send_email(
        to_email,
        f"💜 {investor_name} is interested in {_esc(startup_name)}",
        _shell(inner, "This is an automated email from FounderHub AI."),
    )


def send_data_room_access_requested_email(
    to_email: str, to_name: str, investor_name: str, startup_name: str, manage_url: str
) -> bool:
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#A78BFA", "Access Request")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">{_esc(investor_name)} requested access to your data room</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(to_name)}, an investor wants to review the <strong style="color:#FFFFFF;">{_esc(startup_name)}</strong> data room.</p>
        {_cta(manage_url, "Review Access Request")}
      </div>"""
    return send_email(
        to_email,
        f"{investor_name} requested access to your data room",
        _shell(inner, "This is an automated email from FounderHub AI."),
    )


def send_data_room_access_approved_email(
    to_email: str, to_name: str, startup_name: str, data_room_url: str
) -> bool:
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#34D399", "Access Granted")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">You have access to {_esc(startup_name)}</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(to_name)}, you have been granted access to the {_esc(startup_name)} data room.</p>
        {_cta(data_room_url, "Open Data Room")}
      </div>"""
    return send_email(
        to_email,
        f"You have been granted access to {startup_name} data room",
        _shell(inner, "This is an automated email from FounderHub AI."),
    )


def send_document_viewed_email(
    to_email: str, to_name: str, viewer_name: str, document_name: str
) -> bool:
    inner = f"""
      <div style="background:#1A1A1A;border:1px solid #2A2A2A;border-radius:16px;padding:32px;margin-bottom:24px;">
        {_badge("#60A5FA", "Document Viewed")}
        <h1 style="color:#FFFFFF;font-size:22px;font-weight:700;margin:16px 0 8px;">{_esc(viewer_name)} viewed your document</h1>
        <p style="color:#9CA3AF;font-size:15px;margin:0 0 24px;">Hi {_esc(to_name)}, someone reviewed <strong style="color:#FFFFFF;">{_esc(document_name)}</strong> in your data room.</p>
      </div>"""
    return send_email(
        to_email,
        f"{viewer_name} viewed your {document_name}",
        _shell(inner, "This is an automated email from FounderHub AI."),
    )
