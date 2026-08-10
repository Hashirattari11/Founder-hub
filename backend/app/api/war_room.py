"""AI Startup War Room API — Founder-only command center.

RBAC: every route requires the caller to be the founder of the startup (or an
administrator). Founder-of-startup is resolved from `startups.founder_id`.
Task assignment can notify other users; plan/task/insight mutations are
scoped to the founder (or admin).
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.core.auth import get_user_id
from app.core.rbac import get_user_roles, is_admin_user
from app.core.supabase import service_supabase
from app.services import startup_insights as si
from app.services import war_room as wr
from app.services.notification_service import notify

router = APIRouter(prefix="/api/war-room", tags=["war-room"])


def _require_founder_of(startup_id: str, user_id: str) -> None:
    if is_admin_user(user_id):
        return
    res = service_supabase.table("startups").select("founder_id").eq("id", startup_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Startup not found")
    if res.data[0].get("founder_id") != user_id:
        raise HTTPException(status_code=403, detail="Only the founder of this startup can access the War Room")


def _get_startup(startup_id: str) -> dict:
    res = service_supabase.table("startups").select("*").eq("id", startup_id).limit(1).execute()
    if not res.data:
        raise HTTPException(status_code=404, detail="Startup not found")
    return res.data[0]


def _get_plan_owner(plan_id: str) -> Optional[str]:
    """Return the startup_id a plan belongs to (None when missing)."""
    res = service_supabase.table("war_room_plans").select("startup_id").eq("id", plan_id).limit(1).execute()
    return res.data[0]["startup_id"] if res.data else None


def _get_task_owner(task_id: str) -> Optional[str]:
    res = service_supabase.table("war_room_tasks").select("startup_id").eq("id", task_id).limit(1).execute()
    return res.data[0]["startup_id"] if res.data else None


class PlanIn(BaseModel):
    duration_days: int = 30
    focus: str = ""


class TaskIn(BaseModel):
    plan_id: Optional[str] = None
    title: str
    description: str = ""
    goal: str = ""
    priority: str = "medium"
    assigned_role: str = "founder"
    assignee_id: Optional[str] = None
    deadline: Optional[str] = None
    status: str = "todo"


class TaskPatch(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    goal: Optional[str] = None
    priority: Optional[str] = None
    assigned_role: Optional[str] = None
    assignee_id: Optional[str] = None
    deadline: Optional[str] = None
    status: Optional[str] = None
    sort_order: Optional[int] = None


class InsightDelete(BaseModel):
    insight_id: str


@router.get("/startups/{startup_id}/dashboard")
async def dashboard(startup_id: str, refresh_insights: bool = False, user_id: str = Depends(get_user_id)):
    """Founder command center: cached health/readiness/gaps + insights + plans."""
    _require_founder_of(startup_id, user_id)
    startup = _get_startup(startup_id)
    sd = si.collect_startup_data(startup_id)

    coverage = si.coverage_report(sd)
    health = si.score_health(sd)
    readiness = si.score_investor_readiness(sd)
    gaps = si.score_team_gaps(sd)

    insights = []
    if refresh_insights:
        deterministic = wr.deterministic_insights(sd)
        ai = await wr._ai_insight_enrichment(user_id, sd, deterministic)
        wr.save_insights(startup_id, user_id, deterministic + ai)
    else:
        # prefer stored insights; fall back to deterministic when none exist
        stored = service_supabase.table("war_room_insights").select("*").eq("startup_id", startup_id).order("created_at", desc=True).limit(30).execute()
        if stored.data:
            insights = stored.data
        else:
            insights = wr.deterministic_insights(sd)

    return {
        "startup": startup,
        "coverage": coverage,
        "health": health,
        "readiness": readiness,
        "team_gaps": gaps,
        "snapshot": wr.dashboard_snapshot(startup_id),
        "insights": insights,
        "plans": wr.list_plans(startup_id),
    }


@router.post("/startups/{startup_id}/plans")
async def create_plan(startup_id: str, body: PlanIn, user_id: str = Depends(get_user_id)):
    _require_founder_of(startup_id, user_id)
    _get_startup(startup_id)
    duration = body.duration_days
    if duration not in (30, 60, 90):
        raise HTTPException(status_code=400, detail="duration_days must be 30, 60 or 90")
    try:
        result = wr.generate_plan(user_id, startup_id, duration, body.focus)
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    return result


@router.get("/plans")
async def list_plans(user_id: str = Depends(get_user_id)):
    """All plans for startups the caller founds (or all, for admins)."""
    if is_admin_user(user_id):
        res = service_supabase.table("war_room_plans").select("*").order("created_at", desc=True).limit(50).execute()
        plans = res.data or []
    else:
        startups = service_supabase.table("startups").select("id").eq("founder_id", user_id).execute()
        ids = [s["id"] for s in startups.data or []]
        if not ids:
            return []
        res = service_supabase.table("war_room_plans").select("*").in_("startup_id", ids).order("created_at", desc=True).limit(50).execute()
        plans = res.data or []
    for p in plans:
        done = service_supabase.table("war_room_tasks").select("id", count="exact").eq("plan_id", p["id"]).eq("status", "done").execute()
        total = service_supabase.table("war_room_tasks").select("id", count="exact").eq("plan_id", p["id"]).execute()
        p["task_count"] = int(total.count or 0)
        p["done_count"] = int(done.count or 0)
    return plans


@router.get("/plans/{plan_id}")
async def get_plan(plan_id: str, user_id: str = Depends(get_user_id)):
    startup_id = _get_plan_owner(plan_id)
    if not startup_id:
        raise HTTPException(status_code=404, detail="Plan not found")
    _require_founder_of(startup_id, user_id)
    plan = wr.get_plan(plan_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan


@router.post("/tasks")
async def create_task(body: TaskIn, user_id: str = Depends(get_user_id)):
    if body.plan_id:
        startup_id = _get_plan_owner(body.plan_id)
    else:
        raise HTTPException(status_code=400, detail="plan_id is required")
    if not startup_id:
        raise HTTPException(status_code=404, detail="Plan not found")
    _require_founder_of(startup_id, user_id)
    task = wr.create_task(startup_id, user_id, body.model_dump(exclude_none=True))
    if task.get("assignee_id"):
        notify(
            task["assignee_id"],
            "war_room_task",
            "New War Room task",
            task.get("title") or "New task assigned to you",
            {"startup_id": startup_id, "task_id": task.get("id")},
            email=False,
        )
    return task


@router.patch("/tasks/{task_id}")
async def patch_task(task_id: str, body: TaskPatch, user_id: str = Depends(get_user_id)):
    startup_id = _get_task_owner(task_id)
    if not startup_id:
        raise HTTPException(status_code=404, detail="Task not found")
    _require_founder_of(startup_id, user_id)
    task = wr.update_task(task_id, body.model_dump(exclude_none=True))
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    if task.get("assignee_id") and task.get("assignee_id") != user_id:
        notify(
            task["assignee_id"],
            "war_room_task",
            "War Room task updated",
            task.get("title") or "A task you are assigned to was updated",
            {"startup_id": startup_id, "task_id": task.get("id")},
            email=False,
        )
    return task


@router.post("/startups/{startup_id}/insights")
async def refresh_insights(startup_id: str, user_id: str = Depends(get_user_id)):
    """Re-run deterministic + AI insight generation (writes new rows)."""
    _require_founder_of(startup_id, user_id)
    _get_startup(startup_id)
    sd = si.collect_startup_data(startup_id)
    deterministic = wr.deterministic_insights(sd)
    ai = await wr._ai_insight_enrichment(user_id, sd, deterministic)
    saved = wr.save_insights(startup_id, user_id, deterministic + ai)
    return {"count": len(saved), "insights": saved}


@router.delete("/insights/{insight_id}")
async def delete_insight(insight_id: str, user_id: str = Depends(get_user_id)):
    row = service_supabase.table("war_room_insights").select("startup_id").eq("id", insight_id).limit(1).execute()
    if not row.data:
        raise HTTPException(status_code=404, detail="Insight not found")
    _require_founder_of(row.data[0]["startup_id"], user_id)
    wr.delete_insight(insight_id)
    return {"ok": True}


@router.get("/admin/summary")
async def admin_summary(user_id: str = Depends(get_user_id)):
    """Admin-only usage summary for the War Room feature."""
    if not is_admin_user(user_id):
        raise HTTPException(status_code=403, detail="Admins only")
    plans = service_supabase.table("war_room_plans").select("id", "startup_id", "duration_days", "created_at").order("created_at", desc=True).limit(200).execute()
    tasks = service_supabase.table("war_room_tasks").select("id", "status").limit(5000).execute()
    insights = service_supabase.table("war_room_insights").select("id", "insight_type").limit(5000).execute()
    logs = service_supabase.table("ai_usage_logs").select("*").eq("tool_slug", "war_room_plan").order("created_at", desc=True).limit(50).execute()
    tasks_rows = tasks.data or []
    status_counts = {}
    for t in tasks_rows:
        status_counts[t.get("status") or "todo"] = status_counts.get(t.get("status") or "todo", 0) + 1
    return {
        "plans": len(plans.data or []),
        "tasks": len(tasks_rows),
        "task_status": status_counts,
        "insights": len(insights.data or []),
        "recent_ai_calls": logs.data or [],
    }
