from typing import Optional
from fastapi import APIRouter, HTTPException
from app.core.supabase import supabase, service_supabase

router = APIRouter(prefix="/api/startups", tags=["startups"])

EMAIL_FROM = "onboarding@resend.dev"


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
    try:
        result = service_supabase.table("profiles").select("email").eq("id", user_id).limit(1).execute()
    except Exception:
        result = supabase.table("profiles").select("email").eq("id", user_id).limit(1).execute()
    if result.data:
        return result.data[0].get("email")
    # Fall back to auth.users lookup via service role
    try:
        result = service_supabase.auth.admin.get_user_by_id(user_id)
        return result.user.email if result.user else None
    except Exception:
        return None


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

    print(f"[matching] notified {notified} users for startup {startup_id}")
    return notified


def notify_investors(startup: dict) -> int:
    """Notify investors whose interests overlap the startup's industry."""
    startup_industry = (startup.get("industry") or "").lower()
    if not startup_industry:
        return 0

    users = get_role_users(["investor"])
    startup_id = startup.get("id")
    startup_name = startup.get("name") or "A startup"

    notified = 0
    for user in users:
        interests = [i.lower() for i in (user.get("investor_interests") or [])]
        if not interests:
            continue
        if any(startup_industry in i or i in startup_industry for i in interests):
            ok = _notify_user(
                user["id"],
                "startup_match",
                "New startup in your sector",
                f"{startup_name} just launched in {startup.get('industry')}",
                {"startup_id": startup_id, "match_score": 0},
            )
            if ok:
                notified += 1

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
