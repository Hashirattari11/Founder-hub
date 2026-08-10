"""AI Due-Diligence API — Investor-only startup analysis workspace.

RBAC: every route requires the caller to hold the `investor` role (or be an
administrator). Authorization is enforced here in the backend — never trusted
from the frontend. Data Room documents are only analyzed after the investor
holds an active, valid access grant (enforced in the service layer).
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.rbac import get_user_roles, is_admin_user
from app.core.supabase import service_supabase
from app.services import due_diligence as dd
from app.services.notification_service import notify

router = APIRouter(prefix="/api/due-diligence", tags=["due-diligence"])


def _require_investor(user_id: str) -> None:
    roles = get_user_roles(user_id)
    if "investor" in roles or is_admin_user(user_id):
        return
    raise HTTPException(status_code=403, detail="Investor-only feature")


def _get_startup(startup_id: str) -> dict:
    res = service_supabase.table("startups").select("*").eq("id", startup_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Startup not found")
    return res.data[0]


class RefreshIn(BaseModel):
    pass


@router.post("/startups/{startup_id}/reports")
async def generate_report(startup_id: str, user_id: str = Depends(get_user_id)):
    _require_investor(user_id)
    startup = _get_startup(startup_id)

    sd = dd.collect_dd_data(startup_id, user_id)
    if not sd:
        raise HTTPException(status_code=404, detail="Startup not found")

    coverage = si_coverage(sd)
    deterministic = dd.score_due_diligence(sd)
    deterministic["has_dd_access"] = bool((sd.get("dd_access") or {}).get("has_access"))

    if coverage["insufficient"] and not (sd.get("dd_access") or {}).get("has_access"):
        result = {
            "insufficient": True,
            "cached": False,
            "data_coverage": coverage,
            "score": None,
            "risk_level": None,
            "sections": deterministic["sections"],
            "strengths": [],
            "weaknesses": [],
            "risks": deterministic["risks"],
            "missing_info": deterministic["missing_info"],
            "questions": deterministic["questions"],
            "next_steps": deterministic["next_steps"],
            "summary": "Not enough data to score this startup yet. Founders should complete their profile, add traction and open a data room.",
        }
    else:
        narrative = await dd._ai_narrative(sd, user_id, deterministic)
        result = dd._apply_narrative(deterministic, narrative)
        result["insufficient"] = False
        result["cached"] = False
        result["data_coverage"] = coverage
        result["has_dd_access"] = bool((sd.get("dd_access") or {}).get("has_access"))
        result["dd_access_status"] = (sd.get("dd_access") or {}).get("request_status")
        result["data_room_score"] = deterministic.get("data_room_score")

    row = {
        "investor_id": user_id,
        "startup_id": startup_id,
        "score": result.get("score"),
        "risk_level": result.get("risk_level"),
        "sections": result["sections"],
        "strengths": result["strengths"],
        "weaknesses": result["weaknesses"],
        "risks": result["risks"],
        "missing_info": result["missing_info"],
        "questions": result["questions"],
        "next_steps": result["next_steps"],
        "summary": result.get("summary") or "",
        "data_coverage": coverage,
        "insufficient": result.get("insufficient", False),
        "provider": "platform",
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    saved = dd.save_report(row)
    result["id"] = saved.get("id")
    result["last_analyzed"] = saved.get("updated_at") or saved.get("created_at")
    return result


@router.get("/startups/{startup_id}/reports")
async def get_report(startup_id: str, refresh: bool = False, user_id: str = Depends(get_user_id)):
    _require_investor(user_id)
    _get_startup(startup_id)

    cached = dd.fetch_cached(user_id, startup_id)
    if dd.fresh(cached, refresh):
        return {
            "insufficient": bool(cached.get("insufficient")),
            "cached": True,
            "id": cached.get("id"),
            "score": cached.get("score"),
            "risk_level": cached.get("risk_level"),
            "sections": cached.get("sections") or [],
            "strengths": cached.get("strengths") or [],
            "weaknesses": cached.get("weaknesses") or [],
            "risks": cached.get("risks") or [],
            "missing_info": cached.get("missing_info") or [],
            "questions": cached.get("questions") or [],
            "next_steps": cached.get("next_steps") or [],
            "summary": cached.get("summary") or "",
            "data_coverage": cached.get("data_coverage") or {},
            "last_analyzed": cached.get("updated_at") or cached.get("created_at"),
        }
    return {
        "insufficient": False,
        "cached": False,
        "report_exists": bool(cached),
        "last_analyzed": (cached or {}).get("updated_at") or (cached or {}).get("created_at"),
        "message": "Run AI Due-Diligence to generate the report.",
    }


@router.get("/reports/me")
async def my_reports(user_id: str = Depends(get_user_id)):
    _require_investor(user_id)
    res = service_supabase.table("due_diligence_reports").select("*").eq("investor_id", user_id).order("updated_at", desc=True).limit(50).execute()
    rows = res.data or []
    startup_ids = {r.get("startup_id") for r in rows if r.get("startup_id")}
    startups = {}
    if startup_ids:
        sres = service_supabase.table("startups").select("id, name, tagline, industry, stage, location").in_("id", list(startup_ids)).limit(100).execute()
        startups = {s["id"]: s for s in (sres.data or [])}
    out = []
    for r in rows:
        s = startups.get(r.get("startup_id")) or {}
        out.append({
            "report": {
                "id": r.get("id"),
                "score": r.get("score"),
                "risk_level": r.get("risk_level"),
                "insufficient": bool(r.get("insufficient")),
                "updated_at": r.get("updated_at") or r.get("created_at"),
            },
            "startup": s,
        })
    return {"reports": out}


@router.delete("/reports/{report_id}")
async def delete_report(report_id: str, user_id: str = Depends(get_user_id)):
    _require_investor(user_id)
    res = service_supabase.table("due_diligence_reports").select("id").eq("id", report_id).eq("investor_id", user_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Report not found")
    service_supabase.table("due_diligence_reports").delete().eq("id", report_id).execute()
    return {"success": True}


@router.post("/startups/{startup_id}/request-access")
async def request_data_room_access(startup_id: str, user_id: str = Depends(get_user_id)):
    """Convenience: request data room access for the due-diligence flow."""
    _require_investor(user_id)
    startup = _get_startup(startup_id)
    room = (
        service_supabase.table("data_rooms")
        .select("*")
        .eq("startup_id", startup_id)
        .limit(1)
        .execute()
    )
    if not room.data:
        raise HTTPException(status_code=400, detail="This startup has no data room yet")
    dr = room.data[0]
    if dr.get("founder_id") == user_id:
        raise HTTPException(status_code=400, detail="You own this startup")
    existing = service_supabase.table("data_room_access").select("id").eq("data_room_id", dr["id"]).eq("user_id", user_id).eq("is_active", True).limit(1).execute()
    if existing.data:
        raise HTTPException(status_code=400, detail="You already have access to this data room")

    req = service_supabase.table("data_room_access_requests").select("id, status").eq("data_room_id", dr["id"]).eq("requester_id", user_id).limit(1).execute()
    if req.data and req.data[0].get("status") == "pending":
        return {"success": True, "request_status": "pending"}
    service_supabase.table("data_room_access_requests").upsert(
        {"data_room_id": dr["id"], "requester_id": user_id, "message": "Requested via AI Due-Diligence"},
        on_conflict="data_room_id,requester_id",
    ).execute()

    try:
        prof = service_supabase.table("profiles").select("full_name").eq("id", user_id).limit(1).execute()
        name = (prof.data or [{}])[0].get("full_name") or "An investor"
        notify(
            dr.get("founder_id"),
            "data_room_access_requested",
            "Data room access requested",
            f"{name} requested access to your {startup.get('name')} data room (via AI Due-Diligence)",
            {"data_room_id": dr["id"], "startup_id": startup_id},
            email=True,
            template="data_room_access_requested",
            template_data={
                "user_name": name,
                "from_name": name,
                "startup_name": startup.get("name") or "your startup",
                "action_url": f"/startups/{startup_id}/data-room",
            },
            dedupe_key=f"dd_access_requested:{dr.get('founder_id')}:{startup_id}",
        )
    except Exception as exc:
        print(f"[due-diligence] notify failed: {exc}")
    return {"success": True, "request_status": "pending"}


async def _admin_dep(user_id: str = Depends(get_user_id)) -> str:
    if not is_admin_user(user_id):
        raise HTTPException(status_code=403, detail="Admins only")
    return user_id


@router.get("/admin/summary")
async def admin_summary(_: str = Depends(_admin_dep)):
    def _count(table: str) -> int:
        try:
            res = service_supabase.table(table).select("id", count="exact").limit(1).execute()
            return int(res.count or 0)
        except Exception:
            return 0

    recent = []
    try:
        rres = service_supabase.table("due_diligence_reports").select(
            "id, startup_id, investor_id, score, risk_level, updated_at"
        ).order("updated_at", desc=True).limit(10).execute()
        recent = rres.data or []
    except Exception:
        recent = []
    return {
        "reports_total": _count("due_diligence_reports"),
        "recent_reports": recent,
    }


def si_coverage(sd: dict) -> dict:
    from app.services import startup_insights as si
    return si.coverage_report(sd)
