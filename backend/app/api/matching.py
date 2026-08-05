from typing import Optional
from fastapi import APIRouter, HTTPException
from app.core.supabase import service_supabase, supabase
from app.core.users import user_email as _user_email_lookup
from app.services.email_service import (
    send_developer_notification,
    send_investor_notification,
)

router = APIRouter(prefix="/api/startups", tags=["startups"])


def _notify_user(user_id: str, ntype: str, title: str, body: str, data: Optional[dict] = None) -> bool:
    """Insert a notification for any user (uses service role, bypasses RLS)."""
    try:
        row = {
            "user_id": user_id,
            "type": ntype,
            "title": title,
            "body": body,
            "data": data or {},
        }
        result = service_supabase.table("notifications").insert(row).execute()
        return bool(result.data)
    except Exception as exc:
        print(f"[notifications] failed to notify {user_id}: {exc}")
        return False


def get_user_email(user_id: str) -> str | None:
    return _user_email_lookup(user_id)


def calculate_match_score(user_profile: dict, startup: dict) -> int:
    """Score a user against a startup. 0–100.

    - Skills match (max 40): each overlapping skill/role worth 10
    - Role match (max 30): user's primary role is a role the startup needs
    - Location match (max 15): same city, or remote-friendly (10)
    - Experience match (max 15): 3+ years (15), 1+ year (8)
    """
    score = 0

    user_skills = set(user_profile.get("skills") or [])
    startup_tech = set(startup.get("tech_stack") or [])
    startup_roles = set(startup.get("team_roles_needed") or [])

    skill_overlap = len(user_skills.intersection(startup_tech))
    score += min(skill_overlap * 10, 40)

    user_role = (user_profile.get("role") or "").lower()
    if user_role in [r.lower() for r in startup_roles]:
        score += 30

    if startup.get("location") == user_profile.get("city"):
        score += 15
    elif startup.get("remote_friendly"):
        score += 10

    exp = user_profile.get("experience_years") or 0
    if exp >= 3:
        score += 15
    elif exp >= 1:
        score += 8

    return min(score, 100)


def get_role_users(roles: list[str]) -> list[dict]:
    """All profiles whose primary role is in `roles`."""
    query = (
        service_supabase.table("profiles")
        .select("*")
        .in_("role", roles)
        .execute()
    )
    return query.data or []


def calculate_investor_match(investor_profile: dict, startup: dict) -> int:
    """Score an investor against a startup. 0–100.

    - Industry match (max 50): any investor interest overlaps the startup industry
    - Funding range (max 30): startup's funding midpoint falls in the investor's range
    - Stage match (max 20): startup stage is one the investor funds
    """
    score = 0

    interests = [i.lower() for i in (investor_profile.get("investor_interests") or [])]
    industry = (startup.get("industry") or "").lower()
    if any(industry in i or i in industry for i in interests):
        score += 50

    funding = startup.get("funding_needed")
    midpoint = FUNDING_MIDPOINTS.get(funding, 0)
    if midpoint is not None:
        low = investor_profile.get("investment_range_min") or 0
        high = investor_profile.get("investment_range_max") or 1_000_000
        if low <= midpoint <= high:
            score += 30

    stage = (startup.get("stage") or "").lower()
    stages = [s.lower() for s in (investor_profile.get("investment_stage") or [])]
    if stage and stage in stages:
        score += 20

    return min(score, 100)


FUNDING_MIDPOINTS = {
    "Bootstrapped": 0,
    "Under $10K": 5,
    "$10K-$50K": 30,
    "$50K-$100K": 75,
    "$100K-$500K": 300,
    "$500K+": 750,
}


def _prefers(profile: dict, key: str, default: bool = True) -> bool:
    """Read a notification preference from the profile's JSONB blob."""
    prefs = profile.get("notification_preferences") or {}
    if not isinstance(prefs, dict):
        return default
    return bool(prefs.get(key, default))


def _log_email(startup_id: str, recipient_id: str, email: str, email_type: str, score: int | None) -> None:
    """Best-effort insert into email_logs (service role bypasses RLS)."""
    try:
        service_supabase.table("email_logs").insert(
            {
                "startup_id": startup_id,
                "recipient_id": recipient_id,
                "recipient_email": email,
                "email_type": email_type,
                "match_score": score,
            }
        ).execute()
    except Exception as exc:
        print(f"[matching] failed to log email to {email}: {exc}")


def notify_matched_users(startup: dict) -> int:
    """Notify developer/designer/marketer users whose match score >= 50."""
    roles = ["developer", "designer", "marketer"]
    users = get_role_users(roles)

    startup_id = startup.get("id")
    startup_name = startup.get("name") or "A startup"
    startup_roles = startup.get("team_roles_needed") or []

    notified = 0
    for user in users:
        score = calculate_match_score(user, startup)
        if score < 50:
            continue

        role = ""
        user_role = (user.get("role") or "").lower()
        for r in startup_roles:
            if r.lower() == user_role:
                role = r
                break
        if not role and user_role in ["developer", "designer", "marketer"]:
            role = user_role.capitalize()

        ok = _notify_user(
            user["id"],
            "startup_match",
            "New startup matches your skills",
            f"{startup_name} is looking for a {role}",
            {"startup_id": startup_id, "match_score": score},
        )
        if ok:
            notified += 1

        # Email the matched user (respects notification preferences).
        email = get_user_email(user["id"])
        if email and _prefers(user, "email_new_match"):
            name = user.get("full_name") or "there"
            email_ok = send_developer_notification(email, name, startup, score, role)
            if email_ok:
                _log_email(startup_id, user["id"], email, "developer_match", score)

    print(f"[matching] notified {notified} users for startup {startup_id}")
    return notified


def notify_investors(startup: dict) -> int:
    """Notify investors whose interests overlap the startup's industry."""
    users = get_role_users(["investor"])
    startup_id = startup.get("id")
    startup_name = startup.get("name") or "A startup"

    notified = 0
    for user in users:
        score = calculate_investor_match(user, startup)
        if score < 40:
            continue

        ok = _notify_user(
            user["id"],
            "startup_match",
            "New startup in your sector",
            f"{startup_name} just launched in {startup.get('industry')}",
            {"startup_id": startup_id, "match_score": score},
        )
        if ok:
            notified += 1

        email = get_user_email(user["id"])
        if email and _prefers(user, "email_new_match"):
            name = user.get("full_name") or "there"
            email_ok = send_investor_notification(email, name, startup, score)
            if email_ok:
                _log_email(startup_id, user["id"], email, "investor_match", score)

    return notified


@router.post("/{startup_id}/notify-matches")
async def trigger_notify_matches(startup_id: str):
    """Run matching for a published startup and notify matched users.

    Returns the number of users notified.
    """
    result = supabase.table("startups").select("*").eq("id", startup_id).limit(1).execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Startup not found")

    startup = result.data[0]
    if not startup.get("is_published"):
        raise HTTPException(status_code=400, detail="Startup is not published")

    talent = notify_matched_users(startup)
    investors = notify_investors(startup)

    return {
        "startup_id": startup_id,
        "notified_users": talent + investors,
        "matched_talent": talent,
        "matched_investors": investors,
    }
