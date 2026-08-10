"""AI Match Engine API — explainable matching for every role.

RBAC:
- Founder: runs matching for a startup they own (or any startup, as admin),
  sees matches where startup_id is one of their startups.
- Investor / talent: sees matches where target_user_id = them, and can run
  reverse matching (their profile against published startups).
- Admin: full visibility + summary.
All scoring is deterministic and explainable (see matching_engine).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.rbac import get_user_roles, get_user_primary_role, is_admin_user
from app.core.supabase import service_supabase
from app.services import matching_engine as me

router = APIRouter(prefix="/api/ai-matches", tags=["ai-matches"])

TALENT_AND_INVESTOR_ROLES = sorted(me.TALENT_ROLES | {"investor"})

# Match threshold for reverse (investor/talent -> startups) matching.
REVERSE_MIN_SCORE = 50


def _get_startup(startup_id: str) -> dict:
    res = service_supabase.table("startups").select("*").eq("id", startup_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Startup not found")
    return res.data[0]


def _is_founder_of(user_id: str, startup: dict) -> bool:
    return startup.get("founder_id") == user_id


def _startup_ids_for_founder(user_id: str) -> list[str]:
    res = service_supabase.table("startups").select("id").eq("founder_id", user_id).execute()
    return [s["id"] for s in res.data or []]


def _profile(user_id: str) -> dict:
    res = service_supabase.table("profiles").select("*").eq("id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Profile not found")
    return res.data[0]


def _attach_startups(rows: list[dict]) -> list[dict]:
    """Attach minimal startup info to match rows."""
    ids = {r.get("startup_id") for r in rows if r.get("startup_id")}
    if not ids:
        return rows
    res = service_supabase.table("startups").select("id, name, tagline, industry, stage, location, is_published").in_("id", list(ids)).execute()
    by_id = {s["id"]: s for s in res.data or []}
    out = []
    for r in rows:
        r["startup"] = by_id.get(r.get("startup_id"))
        out.append(r)
    return out


class RunIn(BaseModel):
    startup_id: Optional[str] = None  # founders: which startup to match


@router.get("/me")
async def my_matches(user_id: str = Depends(get_user_id)):
    """Matches relevant to the caller (their startups' matches, or matches where they are the target)."""
    roles = get_user_roles(user_id)
    rows: list[dict] = []
    if "founder" in roles and not is_admin_user(user_id):
        ids = _startup_ids_for_founder(user_id)
        if ids:
            res = service_supabase.table("ai_matches").select("*").in_("startup_id", ids).order("score", desc=True).limit(100).execute()
            rows = res.data or []
    elif is_admin_user(user_id):
        res = service_supabase.table("ai_matches").select("*").order("score", desc=True).limit(100).execute()
        rows = res.data or []
    else:
        res = service_supabase.table("ai_matches").select("*").eq("target_user_id", user_id).order("score", desc=True).limit(100).execute()
        rows = res.data or []
    # Only surface non-dismissed matches by default.
    rows = [r for r in rows if not r.get("dismissed")]
    return {"matches": _attach_startups(rows)}


@router.post("/run")
async def run_matching(body: RunIn, user_id: str = Depends(get_user_id)):
    """Founder: match a startup they own against talent + investors.
    Investor/talent: reverse match — score their profile against published startups."""
    roles = get_user_roles(user_id)
    is_admin = is_admin_user(user_id)

    # Founder flow: explicit startup owned by caller (or any, for admins).
    if "founder" in roles or is_admin:
        startup_id = body.startup_id
        if not startup_id:
            raise HTTPException(status_code=400, detail="startup_id is required")
        startup = _get_startup(startup_id)
        if not is_admin and not _is_founder_of(user_id, startup):
            raise HTTPException(status_code=403, detail="Only the founder of this startup can run matching")
        stored = me.run_matching(startup, TALENT_AND_INVESTOR_ROLES, min_score=REVERSE_MIN_SCORE, created_by=user_id)
        # Never recommend the founder to themselves.
        stored = [r for r in stored if r.get("target_user_id") != startup.get("founder_id")]
        return {"matches": _attach_startups(stored), "mode": "startup_to_people"}

    # Reverse flow: score published startups against the caller's profile.
    profile = _profile(user_id)
    primary = get_user_primary_role(user_id) or "talent"
    pubs = service_supabase.table("startups").select("*").eq("is_published", True).limit(200).execute()
    rows: list[dict] = []
    for startup in pubs.data or []:
        if startup.get("founder_id") == user_id:
            continue  # skip own startup
        result = me.compute_match(startup, profile, primary, None)
        if result["score"] < REVERSE_MIN_SCORE:
            continue
        row = {
            "startup_id": startup["id"],
            "target_user_id": user_id,
            "role": primary,
            "score": result["score"],
            "scores": result["scores"],
            "reasons": result["reasons"],
            "concerns": result["concerns"],
            "created_by": user_id,
        }
        try:
            res = service_supabase.table("ai_matches").upsert(row, on_conflict="startup_id,target_user_id,role").execute()
            rows.append((res.data or [row])[0])
        except Exception as exc:
            print(f"[ai_matches] failed to store reverse match: {exc}")
    rows.sort(key=lambda r: r.get("score") or 0, reverse=True)
    return {"matches": _attach_startups(rows), "mode": "people_to_startups"}


class SaveIn(BaseModel):
    saved: bool = True


@router.post("/matches/{match_id}/save")
async def save_match(match_id: str, body: SaveIn, user_id: str = Depends(get_user_id)):
    row = service_supabase.table("ai_matches").select("*").eq("id", match_id).limit(1).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Match not found")
    match = row.data[0]
    allowed = (
        match.get("target_user_id") == user_id
        or match.get("created_by") == user_id
        or is_admin_user(user_id)
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="You don't own this match")
    res = service_supabase.table("ai_matches").update({"saved": body.saved}).eq("id", match_id).execute()
    return (res.data or [match])[0]


@router.post("/matches/{match_id}/dismiss")
async def dismiss_match(match_id: str, user_id: str = Depends(get_user_id)):
    row = service_supabase.table("ai_matches").select("*").eq("id", match_id).limit(1).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Match not found")
    match = row.data[0]
    allowed = (
        match.get("target_user_id") == user_id
        or match.get("created_by") == user_id
        or is_admin_user(user_id)
    )
    if not allowed:
        raise HTTPException(status_code=403, detail="You don't own this match")
    res = service_supabase.table("ai_matches").update({"dismissed": True, "saved": False}).eq("id", match_id).execute()
    return (res.data or [match])[0]


@router.get("/discover")
async def discover(user_id: str = Depends(get_user_id)):
    """Published startups the caller could match with (picker for founders)."""
    res = service_supabase.table("startups").select("id, name, tagline, industry, stage, location, is_published").eq("is_published", True).order("created_at", desc=True).limit(200).execute()
    return {"startups": res.data or []}


@router.get("/admin/summary")
async def admin_summary(user_id: str = Depends(get_user_id)):
    """Admin-only usage summary."""
    if not is_admin_user(user_id):
        raise HTTPException(status_code=403, detail="Admins only")
    res = service_supabase.table("ai_matches").select("id", "role", "score", "saved", "dismissed", "created_at").limit(5000).execute()
    rows = res.data or []
    by_role: dict[str, int] = {}
    for r in rows:
        by_role[r.get("role") or "unknown"] = by_role.get(r.get("role") or "unknown", 0) + 1
    return {
        "total": len(rows),
        "by_role": by_role,
        "saved": sum(1 for r in rows if r.get("saved")),
        "dismissed": sum(1 for r in rows if r.get("dismissed")),
        "avg_score": round(sum(r.get("score") or 0 for r in rows) / len(rows), 1) if rows else 0,
    }
