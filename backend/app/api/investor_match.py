"""AI Investor Matching: find investors, intro requests, status updates."""
import json
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.supabase import service_supabase
from app.core.users import user_email
from app.services.email_service import (
    send_investor_interested_email,
    send_investor_match_email,
)

router = APIRouter(prefix="/api/investor-match", tags=["investor-match"])

PROFILE_FIELDS = (
    "id, full_name, username, avatar_url, bio, role, skills, city, country, experience_years, notification_preferences"
)

FUNDING_MIDPOINTS: dict[str, int] = {
    "Bootstrapped": 0,
    "Under $10K": 5,
    "$10K-$50K": 30,
    "$50K-$100K": 75,
    "$100K-$500K": 300,
    "$500K+": 750,
}

VALID_STATUSES = {"pending", "viewed", "interested", "passed", "meeting_scheduled"}


class InvestorRequestIn(BaseModel):
    startup_id: str
    investor_id: str
    message: str


class InvestorStatusIn(BaseModel):
    status: str


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
        print(f"[investor-match] failed to notify {user_id}: {exc}")
        return False


def _prefers(profile: dict, key: str, default: bool = True) -> bool:
    prefs = profile.get("notification_preferences") or {}
    return bool(prefs.get(key, default))


def _funding_midpoint(funding_text: str | None) -> int:
    if not funding_text:
        return 0
    if str(funding_text).isdigit():
        return int(funding_text)
    return FUNDING_MIDPOINTS.get(funding_text, 0)


def find_matching_investors(startup: dict, all_investors: list[dict]) -> list[dict]:
    """Score investors against a startup (0-100) and return top matches with reasons."""
    matches = []
    startup_industry = startup.get("industry") or ""
    startup_stage = startup.get("stage") or ""
    funding = _funding_midpoint(startup.get("funding_needed"))
    startup_location = startup.get("location") or ""

    for investor in all_investors:
        inv_profile = investor.get("investor_profiles") or {}
        if not inv_profile or not inv_profile.get("is_active", True):
            continue

        score = 0
        reasons: list[str] = []

        preferred = set(inv_profile.get("preferred_industries") or [])
        if preferred and startup_industry in preferred:
            score += 35
            reasons.append(f"Invests in {startup_industry}")

        preferred_stages = inv_profile.get("preferred_stages") or []
        if preferred_stages and startup_stage in preferred_stages:
            score += 25
            reasons.append(f"Invests at {startup_stage} stage")

        min_check = inv_profile.get("check_size_min") or 0
        max_check = inv_profile.get("check_size_max") or 999999999
        if min_check <= funding <= max_check:
            score += 25
            reasons.append("Check size matches your funding ask")

        preferred_locs = inv_profile.get("preferred_locations") or []
        if not preferred_locs or "Global" in preferred_locs or startup_location in preferred_locs:
            score += 15
            reasons.append("Invests in your region")

        if score >= 40:
            matches.append(
                {
                    "investor": investor,
                    "score": min(score, 100),
                    "reasons": reasons,
                }
            )

    matches.sort(key=lambda m: m["score"], reverse=True)
    return matches[:10]


def _investor_rows() -> list[dict]:
    result = (
        service_supabase.table("investor_profiles")
        .select(f"*, profile:profiles!investor_profiles_user_id_fkey({PROFILE_FIELDS})")
        .eq("is_active", True)
        .execute()
    )
    investors = []
    for row in result.data or []:
        merged = dict(row.get("profile") or {})
        merged["investor_profiles"] = {
            k: v for k, v in row.items() if k != "profile"
        }
        investors.append(merged)
    return investors


def _get_startup(startup_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("startups")
            .select("*")
            .eq("id", startup_id)
            .maybe_single()
            .execute()
        )
        return result.data
    except Exception:
        return None


@router.post("/find/{startup_id}")
async def find_investors(startup_id: str, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    if startup.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can run investor matching")

    investors = _investor_rows()
    raw_matches = find_matching_investors(startup, investors)

    persisted_rows = []
    for m in raw_matches:
        inv_id = m["investor"]["id"]
        upsert = (
            service_supabase.table("investor_match_requests")
            .upsert(
                {
                    "startup_id": startup_id,
                    "investor_id": inv_id,
                    "founder_id": user_id,
                    "match_score": m["score"],
                    "ai_reasoning": json.dumps(m["reasons"]),
                    "status": "pending",
                },
                on_conflict="startup_id,investor_id",
            )
            .select("id, status")
            .execute()
        )
        persisted = upsert.data[0] if upsert.data else {}
        persisted_rows.append(persisted)

    matches = []
    for m, persisted in zip(raw_matches, persisted_rows):
        matches.append(
            {
                "match_id": persisted.get("id"),
                "status": persisted.get("status", "pending"),
                "score": m["score"],
                "reasons": m["reasons"],
                "investor": m["investor"],
            }
        )

    return {"matches": matches, "total": len(matches)}


@router.get("/my-matches/{startup_id}")
async def get_my_matches(startup_id: str, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    if startup.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can view these matches")

    result = (
        service_supabase.table("investor_match_requests")
        .select(
            "*, investor:profiles!investor_match_requests_investor_id_fkey("
            f"{PROFILE_FIELDS}, investor_profiles:investor_profiles!investor_profiles_user_id_fkey(*))"
        )
        .eq("startup_id", startup_id)
        .order("match_score", desc=True)
        .execute()
    )

    rows = []
    for row in result.data or []:
        inv = row.get("investor") or {}
        inv_profile = (inv.get("investor_profiles") or {}) if isinstance(inv, dict) else {}
        reasons = []
        try:
            reasons = json.loads(row.get("ai_reasoning") or "[]")
        except Exception:
            reasons = []
        rows.append(
            {
                **{k: v for k, v in row.items() if k != "investor"},
                "reasons": reasons,
                "investor": inv,
                "investor_profile": inv_profile,
            }
        )
    return {"matches": rows}


@router.post("/request")
async def send_request(payload: InvestorRequestIn, user_id: str = Depends(get_user_id)):
    startup = _get_startup(payload.startup_id)
    if not startup:
        raise HTTPException(status_code=404, detail="Startup not found")
    if startup.get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder can send an intro request")

    result = (
        service_supabase.table("investor_match_requests")
        .select("*")
        .eq("startup_id", payload.startup_id)
        .eq("investor_id", payload.investor_id)
        .maybe_single()
        .execute()
    )
    row = result.data
    if not row:
        # Create the match row on the fly (find may not have run).
        created = (
            service_supabase.table("investor_match_requests")
            .insert(
                {
                    "startup_id": payload.startup_id,
                    "investor_id": payload.investor_id,
                    "founder_id": user_id,
                    "match_score": 0,
                    "ai_reasoning": "[]",
                    "status": "pending",
                    "message": payload.message,
                }
            )
            .execute()
        )
        row = created.data[0]
    else:
        service_supabase.table("investor_match_requests").update(
            {"status": "pending", "message": payload.message}
        ).eq("id", row["id"]).execute()

    startup_name = startup.get("name") or "their startup"
    investor = _get_profile(payload.investor_id)
    founder = _get_profile(user_id)

    _notify_user(
        payload.investor_id,
        "investor_request",
        f"Intro request: {startup_name}",
        f"A founder reached out about {startup_name} ({row.get('match_score') or 'AI'}% match).",
        {"startup_id": payload.startup_id, "investor_id": payload.investor_id},
    )

    investor_email = user_email(payload.investor_id)
    if investor_email and investor and _prefers(investor, "email_new_match"):
        send_investor_match_email(
            investor_email,
            investor.get("full_name") or "there",
            startup,
            row.get("match_score") or 0,
            _parse_reasons(row.get("ai_reasoning")),
            f"{_frontend_url()}/investor/dashboard",
        )
    return {"success": True, "match_id": row["id"], "status": row.get("status", "pending")}


@router.patch("/{match_id}/status")
async def update_status(match_id: str, payload: InvestorStatusIn, user_id: str = Depends(get_user_id)):
    if payload.status not in VALID_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid status")

    result = (
        service_supabase.table("investor_match_requests")
        .select("*")
        .eq("id", match_id)
        .maybe_single()
        .execute()
    )
    row = result.data
    if not row:
        raise HTTPException(status_code=404, detail="Match not found")
    if row.get("investor_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the investor can update this status")

    service_supabase.table("investor_match_requests").update(
        {"status": payload.status}
    ).eq("id", match_id).execute()

    if payload.status in ("interested", "meeting_scheduled"):
        founder = _get_profile(row.get("founder_id"))
        investor = _get_profile(user_id)
        startup = _get_startup(row.get("startup_id"))
        startup_name = (startup or {}).get("name") or "your startup"
        investor_name = (investor or {}).get("full_name") or "An investor"

        _notify_user(
            row.get("founder_id"),
            "investor_interested",
            f"{investor_name} is interested in {startup_name}",
            payload.status == "meeting_scheduled"
            and "Wants to schedule a meeting with you."
            or "They'd love to learn more about your startup.",
            {"startup_id": row.get("startup_id"), "investor_id": user_id},
        )
        founder_email = user_email(row.get("founder_id"))
        if founder_email and founder:
            send_investor_interested_email(
                founder_email,
                founder.get("full_name") or "there",
                investor or {},
                startup_name,
                f"{_frontend_url()}/startups/{row.get('startup_id')}",
            )

    return {"success": True, "match_id": match_id, "status": payload.status}


def _get_profile(user_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("profiles")
            .select(PROFILE_FIELDS)
            .eq("id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data
    except Exception:
        return None


def _get_investor_profile(user_id: str) -> dict | None:
    try:
        result = (
            service_supabase.table("investor_profiles")
            .select("*")
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
        return result.data
    except Exception:
        return None


def _parse_reasons(raw: str | None) -> list[str]:
    if not raw:
        return []
    try:
        parsed = json.loads(raw)
        return parsed if isinstance(parsed, list) else []
    except Exception:
        return []


def _frontend_url() -> str:
    from app.core.config import settings

    return settings.frontend_url
