"""AI Co-Founder Matching: preferences, matches, requests."""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.config import settings
from app.core.supabase import service_supabase
from app.services.notification_service import notify

router = APIRouter(prefix="/api/cofounder", tags=["cofounder"])

PROFILE_FIELDS = (
    "id, full_name, username, avatar_url, bio, role, skills, city, country, experience_years"
)

COMPLEMENTARY_ROLES: dict[str, dict] = {
    "founder": {
        "looking_for": ["developer", "designer", "marketer", "investor"],
        "tab_label": "Find Co-Founder",
        "description": "Find a technical or growth co-founder",
    },
    "developer": {
        "looking_for": ["founder", "marketer", "designer", "investor"],
        "tab_label": "Find Co-Founder",
        "description": "Find a business or marketing co-founder",
    },
    "designer": {
        "looking_for": ["developer", "founder", "marketer", "investor"],
        "tab_label": "Find Co-Founder",
        "description": "Find a technical or business co-founder",
    },
    "marketer": {
        "looking_for": ["developer", "founder", "designer", "investor"],
        "tab_label": "Find Co-Founder",
        "description": "Find a technical or product co-founder",
    },
    "investor": {
        "looking_for": ["founder", "developer", "designer", "marketer"],
        "tab_label": "Find Co-Founder",
        "description": "Find a founder or team to co-build with",
    },
}

MATCHABLE_ROLES = ["founder", "developer", "designer", "marketer", "investor"]

VALID_COMMITMENTS = {"full_time", "part_time", "flexible"}
VALID_LOCATIONS = {"same_city", "same_country", "remote_ok"}


class SavePrefsIn(BaseModel):
    looking_for_roles: list[str] = []
    industry_focus: list[str] = []
    commitment_level: Optional[str] = None
    equity_willing_to_give: Optional[float] = None
    startup_stage: Optional[str] = None
    location_preference: Optional[str] = None
    description: Optional[str] = None
    is_looking: bool = True


class SendRequestIn(BaseModel):
    target_id: str
    message: str


class RespondRequestIn(BaseModel):
    status: str  # accepted | rejected


def _notify_user(user_id: str, ntype: str, title: str, body: str, data: Optional[dict] = None) -> bool:
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
        print(f"[cofounder] failed to notify {user_id}: {exc}")
        return False


def _normalize_prefs(raw) -> dict:
    if isinstance(raw, list):
        return (raw[0] or {}) if raw else {}
    return raw or {}


def _strip_prefs(profile: dict) -> dict:
    return {k: v for k, v in profile.items() if k != "cofounder_preferences"}


def _compute_match(
    user_profile: dict,
    user_prefs: dict,
    candidate_profile: dict,
    candidate_prefs: dict,
    user_role: str,
    target_roles: list[str],
) -> tuple[int, list[str]]:
    """Score how well a candidate complements the user as a co-founder (0-100)."""
    score = 0
    reasons: list[str] = []

    candidate_role = (candidate_profile.get("role") or "").lower()
    if candidate_role in target_roles:
        score += 40
        reasons.append(f"{candidate_role.capitalize()} complements your {user_role} skills")

    user_industries = set(user_prefs.get("industry_focus") or [])
    candidate_industries = set(candidate_prefs.get("industry_focus") or [])
    common = user_industries.intersection(candidate_industries)
    if common:
        score += 20
        reasons.append(f"Both interested in {sorted(common)[0]}")

    if (
        user_prefs.get("location_preference") == "remote_ok"
        or candidate_prefs.get("location_preference") == "remote_ok"
    ):
        score += 20
        reasons.append("Open to remote collaboration")
    elif user_profile.get("city") and user_profile.get("city") == candidate_profile.get("city"):
        score += 20
        reasons.append(f"Both in {user_profile.get('city')}")

    if (
        user_prefs.get("commitment_level")
        and user_prefs.get("commitment_level") == candidate_prefs.get("commitment_level")
    ):
        score += 10
        reasons.append(f"Same commitment: {user_prefs.get('commitment_level')}")

    if (
        user_prefs.get("startup_stage")
        and user_prefs.get("startup_stage") == candidate_prefs.get("startup_stage")
    ):
        score += 10
        reasons.append("Same startup stage preference")

    return score, reasons


def calculate_cofounder_match(
    user_profile: dict,
    user_prefs: dict,
    candidate_profile: dict,
    candidate_prefs: dict,
) -> int:
    user_role = (user_profile.get("role") or "founder").lower()
    config = COMPLEMENTARY_ROLES.get(user_role, COMPLEMENTARY_ROLES["founder"])
    score, _ = _compute_match(
        user_profile, user_prefs, candidate_profile, candidate_prefs,
        user_role, config["looking_for"],
    )
    return min(score, 100)


def _match_reasons(user_profile: dict, user_prefs: dict, candidate_profile: dict, candidate_prefs: dict) -> list[str]:
    user_role = (user_profile.get("role") or "founder").lower()
    config = COMPLEMENTARY_ROLES.get(user_role, COMPLEMENTARY_ROLES["founder"])
    _, reasons = _compute_match(
        user_profile, user_prefs, candidate_profile, candidate_prefs,
        user_role, config["looking_for"],
    )
    return reasons


def _get_profile(user_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("profiles")
            .select("id, full_name, username, avatar_url, bio, role, skills, city, country, experience_years, notification_preferences")
            .eq("id", user_id)
            .single()
            .execute()
        )
        return result.data or None
    except Exception:
        return None


def _get_prefs(user_id: str) -> dict:
    try:
        result = (
            service_supabase.table("cofounder_preferences")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data or {}
    except Exception:
        return {}


@router.post("/preferences")
async def save_preferences(payload: SavePrefsIn, user_id: str = Depends(get_user_id)):
    if payload.commitment_level and payload.commitment_level not in VALID_COMMITMENTS:
        raise HTTPException(status_code=400, detail="Invalid commitment level")
    if payload.location_preference and payload.location_preference not in VALID_LOCATIONS:
        raise HTTPException(status_code=400, detail="Invalid location preference")

    data = payload.dict()
    data["user_id"] = user_id
    existing = (
        service_supabase.table("cofounder_preferences")
        .select("id")
        .eq("user_id", user_id)
        .execute()
    )
    if existing.data:
        service_supabase.table("cofounder_preferences").update(
            {k: v for k, v in data.items() if k != "user_id"}
        ).eq("user_id", user_id).execute()
    else:
        service_supabase.table("cofounder_preferences").insert(data).execute()
    return {"success": True, "user_id": user_id}


@router.get("/preferences/{user_id}")
async def get_preferences(user_id: str, current_user: str = Depends(get_user_id)):
    if user_id != current_user:
        raise HTTPException(status_code=403, detail="You can only access your own preferences")
    return _get_prefs(user_id) or None


@router.get("/matches/{user_id}")
async def get_matches(user_id: str, role: Optional[str] = None, current_user: str = Depends(get_user_id)):
    if user_id != current_user:
        raise HTTPException(status_code=403, detail="You can only view your own matches")
    try:
        result = (
            service_supabase.table("profiles")
            .select("*, cofounder_preferences(*)")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception:
        result = None
    user = (result.data if result else None) or None
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user_role = (user.get("role") or "founder").lower()

    config = COMPLEMENTARY_ROLES.get(user_role, COMPLEMENTARY_ROLES["founder"])
    target_roles = config["looking_for"]
    if role and role.lower() in MATCHABLE_ROLES:
        target_roles = [role.lower()]
    user_prefs = _normalize_prefs(user.get("cofounder_preferences"))

    candidates = (
        service_supabase.table("profiles")
        .select("*, cofounder_preferences(*)")
        .in_("role", target_roles)
        .neq("id", user_id)
        .execute()
    )

    requests = (
        service_supabase.table("cofounder_requests")
        .select("requester_id, target_id, status")
        .or_(f"requester_id.eq.{user_id},target_id.eq.{user_id}")
        .execute()
    )
    involved: set[str] = set()
    for r in requests.data or []:
        other = r["target_id"] if r["requester_id"] == user_id else r["requester_id"]
        if r["status"] != "rejected":
            involved.add(other)

    matches = []
    for candidate in candidates.data or []:
        if candidate["id"] in involved:
            continue
        candidate_prefs = _normalize_prefs(candidate.get("cofounder_preferences"))
        if not candidate_prefs.get("is_looking", True):
            continue
        score, reasons = _compute_match(
            user, user_prefs, candidate, candidate_prefs, user_role, target_roles
        )
        if score >= 40:
            matches.append(
                {
                    "profile": _strip_prefs(candidate),
                    "preferences": candidate_prefs or None,
                    "score": min(score, 100),
                    "reasons": reasons,
                    "complementary_role": candidate.get("role"),
                }
            )

    matches.sort(key=lambda m: m["score"], reverse=True)
    return {
        "matches": matches[:10],
        "show_cofounder": True,
        "user_role": user_role,
        "looking_for_roles": target_roles,
        "tab_label": config["tab_label"],
        "description": config["description"],
    }


@router.get("/requests/{user_id}")
async def get_requests(user_id: str, current_user: str = Depends(get_user_id)):
    if user_id != current_user:
        raise HTTPException(status_code=403, detail="You can only view your own requests")
    received = (
        service_supabase.table("cofounder_requests")
        .select(f"*, requester:profiles!cofounder_requests_requester_id_fkey({PROFILE_FIELDS})")
        .eq("target_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    sent = (
        service_supabase.table("cofounder_requests")
        .select(f"*, target:profiles!cofounder_requests_target_id_fkey({PROFILE_FIELDS})")
        .eq("requester_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    return {"received": received.data or [], "sent": sent.data or []}


@router.post("/request")
async def send_request(payload: SendRequestIn, user_id: str = Depends(get_user_id)):
    if payload.target_id == user_id:
        raise HTTPException(status_code=400, detail="You cannot send a co-founder request to yourself")

    target = _get_profile(payload.target_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    requester = _get_profile(user_id)
    requester_prefs = _get_prefs(user_id)
    target_prefs = _get_prefs(payload.target_id)

    score = calculate_cofounder_match(requester, requester_prefs, target, target_prefs)

    existing = (
        service_supabase.table("cofounder_requests")
        .select("id, status")
        .eq("requester_id", user_id)
        .eq("target_id", payload.target_id)
        .execute()
    )
    if existing.data:
        if existing.data[0]["status"] == "rejected":
            service_supabase.table("cofounder_requests").update(
                {"status": "pending", "message": payload.message, "match_score": score}
            ).eq("id", existing.data[0]["id"]).execute()
            return {"success": True, "match_score": score}
        raise HTTPException(status_code=409, detail="Co-founder request already sent")

    result = (
        service_supabase.table("cofounder_requests")
        .insert(
            {
                "requester_id": user_id,
                "target_id": payload.target_id,
                "match_score": score,
                "message": payload.message,
                "status": "pending",
            }
        )
        .execute()
    )
    row = result.data[0]

    requester_name = requester.get("full_name") or "Someone"
    _notify_user(
        payload.target_id,
        "cofounder_request",
        f"{requester_name} wants to co-found with you",
        payload.message or f"{score}% match — check out their profile.",
        {"requester_id": user_id, "match_score": score},
    )

    notify(
        payload.target_id,
        "cofounder_request",
        f"{requester_name} wants to co-found with you",
        payload.message or f"{score}% match — check out their profile.",
        {"requester_id": user_id, "match_score": score},
        email=True,
        template="cofounder_request",
        template_data={
            "user_name": target.get("full_name") or "there",
            "from_name": requester_name,
            "match_score": score,
            "message": payload.message or "",
            "action_url": settings.frontend_url_for("/co-founder"),
        },
        dedupe_key=f"cofounder_request:{payload.target_id}:{user_id}",
    )
    return {"success": True, "request": row}


@router.patch("/request/{request_id}")
async def respond_request(request_id: str, payload: RespondRequestIn, user_id: str = Depends(get_user_id)):
    if payload.status not in ("accepted", "rejected"):
        raise HTTPException(status_code=400, detail="Status must be accepted or rejected")

    result = (
        service_supabase.table("cofounder_requests")
        .select("*")
        .eq("id", request_id)
        .maybe_single()
        .execute()
    )
    row = result.data
    if not row:
        raise HTTPException(status_code=404, detail="Request not found")
    if row["target_id"] != user_id:
        raise HTTPException(status_code=403, detail="You cannot respond to this request")

    service_supabase.table("cofounder_requests").update(
        {"status": payload.status}
    ).eq("id", request_id).execute()

    if payload.status == "accepted":
        existing = (
            service_supabase.table("connections")
            .select("*")
            .eq("requester_id", row["requester_id"])
            .eq("receiver_id", row["target_id"])
            .execute()
        )
        if not existing.data:
            service_supabase.table("connections").insert(
                {
                    "requester_id": row["requester_id"],
                    "receiver_id": row["target_id"],
                    "status": "accepted",
                }
            ).execute()

        accepter = _get_profile(user_id)
        requester = _get_profile(row["requester_id"])
        accepter_name = (accepter or {}).get("full_name") or "Someone"
        requester_name = (requester or {}).get("full_name") or "there"
        _notify_user(
            row["requester_id"],
            "cofounder_accepted",
            f"{accepter_name} accepted your co-founder request",
            "You're now connected — say hi and start building!",
            {"requester_id": row["target_id"]},
        )
        notify(
            row["requester_id"],
            "cofounder_accepted",
            f"{accepter_name} accepted your co-founder request",
            "You're now connected — say hi and start building!",
            {"requester_id": row["target_id"]},
            email=True,
            template="cofounder_accepted",
            template_data={
                "user_name": requester_name,
                "from_name": accepter_name,
                "action_url": settings.frontend_url_for("/co-founder"),
            },
            dedupe_key=f"cofounder_accepted:{row['requester_id']}:{row['target_id']}",
        )

    return {"success": True, "request_id": request_id, "status": payload.status, "chat_with": row["requester_id"]}
