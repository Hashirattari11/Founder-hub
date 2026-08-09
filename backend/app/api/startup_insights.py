"""AI Insights API — Startup Health, Team Gap Finder, Investor Readiness,
Explainable Matching.

Access model:
- Founder of the startup (or admin) can view/regenerate analyses + run matching.
- Any authenticated user can view matches that target them (GET /matches/me).
- All reads/writes are done via the service role AFTER server-side ownership
  checks (same pattern as the rest of the backend).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.security import RequireAdmin
from app.core.supabase import service_supabase
from app.services import startup_insights as si
from app.services import matching_engine as me

router = APIRouter(prefix="/api/ai-insights", tags=["ai-insights"])

DEFAULT_MATCH_ROLES = ["developer", "designer", "marketer", "investor"]


class MatchRunIn(BaseModel):
    roles: Optional[list[str]] = None
    weights: Optional[dict] = None
    min_score: int = 50


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _get_startup(startup_id: str) -> dict:
    res = service_supabase.table("startups").select("*").eq("id", startup_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Startup not found")
    return res.data[0]


def _is_admin(user_id: str) -> bool:
    try:
        res = service_supabase.table("profiles").select("is_admin, is_super_admin").eq("id", user_id).limit(1).execute()
        p = (res.data or [{}])[0]
        return bool(p.get("is_admin") or p.get("is_super_admin"))
    except Exception:
        return False


def _require_founder_or_admin(startup: dict, user_id: str) -> None:
    if startup.get("founder_id") == user_id or _is_admin(user_id):
        return
    raise HTTPException(status_code=403, detail="Only the startup founder (or an admin) can do this")


async def _with_narrative(kind: str, sd: dict, user_id: str, deterministic: dict) -> dict:
    """Add AI narrative when data is sufficient; never fabricate numbers."""
    try:
        narrative = await si._ai_narrative(kind, sd, user_id, deterministic)
    except Exception as exc:
        print(f"[ai-insights] narrative fallback failed: {exc}")
        narrative = {}
    return si._apply_narrative(deterministic, narrative)


# ---------------------------------------------------------------------------
# Startup Health
# ---------------------------------------------------------------------------

@router.get("/startups/{startup_id}/health")
async def get_health(startup_id: str, refresh: bool = False, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    _require_founder_or_admin(startup, user_id)

    cached = si._fetch_cached("startup_health_scores", startup_id)
    if si._fresh(cached, refresh):
        return {"insufficient": False, "cached": True, **cached}

    sd = si.collect_startup_data(startup_id)
    coverage = si.coverage_report(sd)
    deterministic = si.score_health(sd)

    if coverage["insufficient"]:
        return {
            "insufficient": True,
            "cached": False,
            "data_coverage": coverage,
            "score": None,
            "categories": deterministic["categories"],
            "strengths": deterministic["strengths"],
            "weaknesses": deterministic["weaknesses"],
            "recommendations": deterministic["recommendations"],
            "summary": "Not enough data to score health yet. Add the missing details below, then analyze again.",
        }

    result = await _with_narrative("health", sd, user_id, deterministic)
    result["data_coverage"] = coverage
    result["insufficient"] = False
    result["cached"] = False
    result["provider"] = cached.get("provider") if cached else "platform"

    row = {
        "startup_id": startup_id,
        "user_id": user_id,
        "score": result["score"],
        "categories": result["categories"],
        "strengths": result["strengths"],
        "weaknesses": result["weaknesses"],
        "recommendations": result["recommendations"],
        "summary": result.get("summary") or "",
        "data_coverage": coverage,
        "provider": result.get("provider"),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    saved = si._save_analysis("startup_health_scores", row)
    return {**result, "id": saved.get("id"), "cached": False}


@router.post("/startups/{startup_id}/health")
async def refresh_health(startup_id: str, user_id: str = Depends(get_user_id)):
    return await get_health(startup_id, refresh=True, user_id=user_id)


# ---------------------------------------------------------------------------
# Team Gap Finder
# ---------------------------------------------------------------------------

@router.get("/startups/{startup_id}/team-gaps")
async def get_team_gaps(startup_id: str, refresh: bool = False, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    _require_founder_or_admin(startup, user_id)

    cached = si._fetch_cached("team_gap_analysis", startup_id)
    if si._fresh(cached, refresh):
        return {"insufficient": False, "cached": True, **cached}

    sd = si.collect_startup_data(startup_id)
    coverage = si.coverage_report(sd)
    deterministic = si.score_team_gaps(sd)

    if coverage["insufficient"] and not deterministic["gaps"]:
        return {
            "insufficient": True,
            "cached": False,
            "data_coverage": coverage,
            "summary": "Not enough data to analyze team gaps. Add a description, team and needed roles, then analyze again.",
            "present_roles": deterministic["present_roles"],
            "gaps": [],
        }

    result = await _with_narrative("team_gaps", sd, user_id, deterministic)
    result["data_coverage"] = coverage
    result["insufficient"] = False
    result["cached"] = False

    row = {
        "startup_id": startup_id,
        "user_id": user_id,
        "summary": result.get("summary") or deterministic["summary"],
        "present_roles": deterministic["present_roles"],
        "gaps": deterministic["gaps"],
        "data_coverage": coverage,
        "provider": cached.get("provider") if cached else "platform",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    saved = si._save_analysis("team_gap_analysis", row)
    return {**result, "id": saved.get("id"), "cached": False}


@router.post("/startups/{startup_id}/team-gaps")
async def refresh_team_gaps(startup_id: str, user_id: str = Depends(get_user_id)):
    return await get_team_gaps(startup_id, refresh=True, user_id=user_id)


# ---------------------------------------------------------------------------
# Investor Readiness
# ---------------------------------------------------------------------------

@router.get("/startups/{startup_id}/investor-readiness")
async def get_investor_readiness(startup_id: str, refresh: bool = False, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    _require_founder_or_admin(startup, user_id)

    cached = si._fetch_cached("investor_readiness_scores", startup_id)
    if si._fresh(cached, refresh):
        return {"insufficient": False, "cached": True, **cached}

    sd = si.collect_startup_data(startup_id)
    coverage = si.coverage_report(sd)
    deterministic = si.score_investor_readiness(sd)

    if coverage["insufficient"]:
        return {
            "insufficient": True,
            "cached": False,
            "data_coverage": coverage,
            "score": None,
            "categories": deterministic["categories"],
            "strengths": deterministic["strengths"],
            "weaknesses": deterministic["weaknesses"],
            "checklist": deterministic["checklist"],
            "summary": "Not enough data to score investor readiness yet. Complete the checklist items below, then analyze again.",
        }

    result = await _with_narrative("investor_readiness", sd, user_id, deterministic)
    result["data_coverage"] = coverage
    result["insufficient"] = False
    result["cached"] = False

    row = {
        "startup_id": startup_id,
        "user_id": user_id,
        "score": result["score"],
        "categories": result["categories"],
        "strengths": result["strengths"],
        "weaknesses": result["weaknesses"],
        "checklist": deterministic["checklist"],
        "summary": result.get("summary") or deterministic["summary"],
        "data_coverage": coverage,
        "provider": cached.get("provider") if cached else "platform",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    saved = si._save_analysis("investor_readiness_scores", row)
    return {**result, "id": saved.get("id"), "cached": False}


@router.post("/startups/{startup_id}/investor-readiness")
async def refresh_investor_readiness(startup_id: str, user_id: str = Depends(get_user_id)):
    return await get_investor_readiness(startup_id, refresh=True, user_id=user_id)


# ---------------------------------------------------------------------------
# Explainable Matching
# ---------------------------------------------------------------------------

@router.post("/startups/{startup_id}/matches")
async def run_matches(startup_id: str, payload: MatchRunIn, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    _require_founder_or_admin(startup, user_id)

    roles = [r.lower() for r in (payload.roles or DEFAULT_MATCH_ROLES) if r]
    min_score = max(0, min(100, payload.min_score or 50))

    stored = me.run_matching(
        startup,
        roles=roles,
        weights=payload.weights,
        min_score=min_score,
        created_by=user_id,
    )
    return {
        "startup_id": startup_id,
        "total_scored": len(me.get_target_users(roles)),
        "matches_kept": len(stored),
        "min_score": min_score,
        "roles": roles,
        "matches": stored,
    }


@router.get("/startups/{startup_id}/matches")
async def list_startup_matches(startup_id: str, role: Optional[str] = None, user_id: str = Depends(get_user_id)):
    startup = _get_startup(startup_id)
    _require_founder_or_admin(startup, user_id)

    q = service_supabase.table("ai_matches").select("*").eq("startup_id", startup_id)
    if role:
        q = q.eq("role", role.lower())
    res = q.order("score", desc=True).limit(100).execute()
    rows = res.data or []

    users = _attach_users(rows)
    return {"startup_id": startup_id, "matches": users}


@router.get("/matches/me")
async def my_matches(user_id: str = Depends(get_user_id)):
    res = service_supabase.table("ai_matches").select("*").eq("target_user_id", user_id).order("score", desc=True).limit(50).execute()
    rows = res.data or []

    startup_ids = {r.get("startup_id") for r in rows if r.get("startup_id")}
    startups = {}
    if startup_ids:
        sres = service_supabase.table("startups").select(
            "id, name, tagline, industry, stage, location, remote_friendly, is_verified, team_roles_needed"
        ).in_("id", list(startup_ids)).limit(100).execute()
        startups = {s["id"]: s for s in (sres.data or [])}

    out = []
    for r in rows:
        s = startups.get(r.get("startup_id")) or {}
        out.append({
            "match": r,
            "startup": s,
        })
    return {"matches": out}


def _attach_users(rows: list[dict]) -> list[dict]:
    ids = {r.get("target_user_id") for r in rows if r.get("target_user_id")}
    by_id: dict = {}
    if ids:
        try:
            res = service_supabase.table("profiles").select(
                "id, full_name, username, avatar_url, role, bio, company, city, skills, experience_years, is_open_to_work"
            ).in_("id", list(ids)).limit(100).execute()
            by_id = {p["id"]: p for p in (res.data or [])}
        except Exception:
            by_id = {}
    out = []
    for r in rows:
        user = by_id.get(r.get("target_user_id")) or {}
        out.append({"match": r, "user": user})
    return out

# ---------------------------------------------------------------------------
# Admin summary (AI Insights activity across the platform)
# ---------------------------------------------------------------------------

@router.get("/admin/summary")
async def admin_insights_summary(_: str = Depends(RequireAdmin())):
    def _count(table: str) -> int:
        try:
            res = service_supabase.table(table).select("id", count="exact").limit(1).execute()
            return int(res.count or 0)
        except Exception:
            return 0

    recent = []
    try:
        rres = service_supabase.table("ai_matches").select(
            "id, startup_id, target_user_id, role, score, created_at"
        ).order("created_at", desc=True).limit(10).execute()
        recent = rres.data or []
    except Exception:
        recent = []

    return {
        "matches_total": _count("ai_matches"),
        "health_analyses": _count("startup_health_scores"),
        "team_gap_analyses": _count("team_gap_analysis"),
        "investor_readiness_analyses": _count("investor_readiness_scores"),
        "recent_matches": recent,
    }
