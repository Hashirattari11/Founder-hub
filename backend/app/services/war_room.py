"""AI Startup War Room service — founder's command center.

Design rules:
- Dashboard data (health, investor readiness, team gaps) is READ from the
  existing cached analysis tables; nothing expensive is recomputed on load.
- Plans are AI-generated from REAL startup data (strict JSON); if AI fails we
  fall back to a deterministic plan built from the founder's actual data.
- Insights: deterministic (from real scores) + optional AI enrichment. Never
  fabricate metrics — when data is missing the insight says so.
- Every AI call is logged to ai_usage_logs for admin monitoring.
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import date, datetime, timedelta, timezone
from typing import Optional

from app.core.supabase import service_supabase
from app.api.ai import generate_text_sync
from app.services import startup_insights as si
from app.services.due_diligence import log_ai_usage


def _pct(value: int, total: int) -> int:
    if total <= 0:
        return 0
    return max(0, min(100, round(value * 100 / total)))


# ---------------------------------------------------------------------------
# Dashboard: reuse cached analyses (cheap reads)
# ---------------------------------------------------------------------------

def dashboard_snapshot(startup_id: str) -> dict:
    """Pull cached health / readiness / gaps without running AI."""
    out = {"health": None, "readiness": None, "gaps": None}
    try:
        h = (
            service_supabase.table("startup_health_scores")
            .select("score, categories, summary, updated_at")
            .eq("startup_id", startup_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if h.data:
            out["health"] = h.data[0]
    except Exception:
        pass
    try:
        r = (
            service_supabase.table("investor_readiness_scores")
            .select("score, categories, summary, updated_at")
            .eq("startup_id", startup_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if r.data:
            out["readiness"] = r.data[0]
    except Exception:
        pass
    try:
        g = (
            service_supabase.table("team_gap_analysis")
            .select("summary, gaps, present_roles, updated_at")
            .eq("startup_id", startup_id)
            .order("updated_at", desc=True)
            .limit(1)
            .execute()
        )
        if g.data:
            out["gaps"] = g.data[0]
    except Exception:
        pass
    return out


# ---------------------------------------------------------------------------
# Plans
# ---------------------------------------------------------------------------

def _plan_prompt(duration_days: int, focus: str, sd: dict) -> str:
    data = si._summarize_startup(sd)
    focus_line = f"\nFOCUS AREA (prioritize this): {focus}" if focus else ""
    return (
        "You are a world-class startup operator/coach. Based ONLY on the following real startup data "
        "(never invent metrics, revenue, users or numbers not listed), create an actionable execution "
        f"plan for the next {duration_days} days.{focus_line}\n\n"
        f"DATA:\n{data}\n\n"
        "Return STRICT JSON only:\n"
        '{"goal": "one-line primary goal", "summary": "2-3 sentence plan summary", '
        '"tasks": [{"title": "actionable task", "description": "short description", '
        '"priority": "high|medium|low", "assigned_role": "founder|developer|designer|marketer|business_analyst|investor|mentor", '
        '"deadline_offset_days": 7, "goal": "which goal this task serves"}]}\n'
        "Return 8-15 tasks spread across the timeline."
    )


def _deterministic_fallback_plan(sd: dict, duration_days: int) -> dict:
    """No-AI fallback built from the founder's REAL data."""
    s = sd["startup"]
    tasks = []
    desc_len = len((s.get("description") or "").strip())
    gap_roles = {g.get("role") for g in si.score_team_gaps(sd).get("gaps", [])}
    if desc_len < 100:
        tasks.append({"title": "Write a detailed startup description", "description": "100+ words covering problem, solution and market.", "priority": "high", "assigned_role": "founder", "deadline_offset_days": 3, "goal": "Profile completeness"})
    if not s.get("tagline"):
        tasks.append({"title": "Add a one-line tagline", "description": "State what you do and for whom.", "priority": "medium", "assigned_role": "founder", "deadline_offset_days": 3, "goal": "Profile completeness"})
    if not s.get("tech_stack"):
        tasks.append({"title": "List your tech stack", "description": "So matching can find the right talent.", "priority": "medium", "assigned_role": "developer", "deadline_offset_days": 5, "goal": "Matching readiness"})
    if not sd.get("members"):
        tasks.append({"title": "Invite team members", "description": "Add at least 1-2 team members on FounderHub.", "priority": "high", "assigned_role": "founder", "deadline_offset_days": 7, "goal": "Team building"})
    for role in sorted(gap_roles)[:3]:
        tasks.append({"title": f"Fill the {role.replace('_', ' ')} gap", "description": f"Find a matching {role.replace('_', ' ')} via AI Matches.", "priority": "high", "assigned_role": "founder", "deadline_offset_days": 10, "goal": "Team building"})
    if not sd.get("cap_table"):
        tasks.append({"title": "Set up your Cap Table", "description": "Document ownership structure.", "priority": "medium", "assigned_role": "founder", "deadline_offset_days": 14, "goal": "Investor readiness"})
    if not (s.get("funding_needed") or "").strip():
        tasks.append({"title": "Define your funding ask", "description": "State funding_needed and equity_offered.", "priority": "high", "assigned_role": "founder", "deadline_offset_days": 14, "goal": "Investor readiness"})
    if not s.get("pitch_deck_url"):
        tasks.append({"title": "Prepare your pitch deck", "description": "Upload a pitch deck for investor review.", "priority": "high", "assigned_role": "founder", "deadline_offset_days": 21, "goal": "Fundraising"})
    if not sd.get("documents"):
        tasks.append({"title": "Open your Data Room", "description": "Upload financial, legal, product and pitch documents.", "priority": "high", "assigned_role": "founder", "deadline_offset_days": 21, "goal": "Investor readiness"})
    if not sd.get("business_plan") or not (sd.get("business_plan") or {}).get("financial_projection"):
        tasks.append({"title": "Create financial projections", "description": "Use the AI Business Plan generator.", "priority": "medium", "assigned_role": "business_analyst", "deadline_offset_days": 25, "goal": "Financial readiness"})
    if len(tasks) < 5:
        tasks.append({"title": "Run AI Matches for your startup", "description": "Find talent and investors matched to your profile.", "priority": "medium", "assigned_role": "founder", "deadline_offset_days": 5, "goal": "Network growth"})
    tasks = tasks[: min(len(tasks), max(5, duration_days // 5))]
    return {
        "goal": f"Execute the top priorities for {s.get('name') or 'this startup'} over the next {duration_days} days.",
        "summary": f"Deterministic {duration_days}-day plan generated from your current profile data (AI unavailable).",
        "tasks": tasks,
    }


def _parse_plan_text(text: str) -> Optional[dict]:
    try:
        parsed = json.loads(text)
    except Exception:
        # tolerate markdown fences
        cleaned = text.strip()
        if cleaned.startswith("```"):
            cleaned = cleaned.strip("`")
            if cleaned.startswith("json"):
                cleaned = cleaned[4:]
        try:
            parsed = json.loads(cleaned)
        except Exception:
            return None
    if not isinstance(parsed, dict) or not isinstance(parsed.get("tasks"), list):
        return None
    tasks = []
    for t in parsed["tasks"][:20]:
        if not isinstance(t, dict) or not t.get("title"):
            continue
        try:
            offset = int(t.get("deadline_offset_days") or 7)
        except Exception:
            offset = 7
        tasks.append({
            "title": str(t["title"])[:200],
            "description": str(t.get("description") or "")[:500],
            "priority": str(t.get("priority") or "medium").lower() if str(t.get("priority") or "medium").lower() in ("high", "medium", "low") else "medium",
            "assigned_role": str(t.get("assigned_role") or "founder").lower()[:50],
            "deadline_offset_days": max(1, min(offset, 120)),
            "goal": str(t.get("goal") or "")[:200],
        })
    if not tasks:
        return None
    return {
        "goal": str(parsed.get("goal") or "")[:300],
        "summary": str(parsed.get("summary") or "")[:600],
        "tasks": tasks,
    }


def generate_plan(user_id: str, startup_id: str, duration_days: int, focus: str = "") -> dict:
    """Generate + persist a plan. Returns {plan, tasks} or raises on hard error."""
    sd = si.collect_startup_data(startup_id)
    if not sd:
        raise ValueError("Startup not found")

    prompt = _plan_prompt(duration_days, focus, sd)
    t0 = time.time()
    plan = None
    err = ""
    try:
        text = asyncio.run(generate_text_sync(user_id, prompt))
        plan = _parse_plan_text(text)
        if not plan:
            err = "AI returned unparsable output"
    except Exception as exc:
        print(f"[war_room] AI plan failed, using deterministic: {exc}")
        err = str(exc)[:300]
    log_ai_usage(user_id, "war_room_plan", "success" if plan else "failed",
                 error=err, duration_ms=int((time.time() - t0) * 1000))
    if not plan:
        plan = _deterministic_fallback_plan(sd, duration_days)

    now = datetime.now(timezone.utc)
    plan_row = {
        "startup_id": startup_id,
        "created_by": user_id,
        "duration_days": duration_days,
        "goal": plan.get("goal") or "",
        "summary": plan.get("summary") or "",
        "status": "active",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
    }
    res = service_supabase.table("war_room_plans").insert(plan_row).execute()
    saved_plan = (res.data or [plan_row])[0]

    task_rows = []
    for i, t in enumerate(plan["tasks"]):
        deadline = (date.today() + timedelta(days=t["deadline_offset_days"])).isoformat()
        task_rows.append({
            "plan_id": saved_plan["id"],
            "startup_id": startup_id,
            "created_by": user_id,
            "title": t["title"],
            "description": t.get("description") or "",
            "goal": t.get("goal") or "",
            "priority": t.get("priority") or "medium",
            "assigned_role": t.get("assigned_role") or "founder",
            "deadline": deadline,
            "status": "todo",
            "sort_order": i,
        })
    saved_tasks = []
    if task_rows:
        tres = service_supabase.table("war_room_tasks").insert(task_rows).execute()
        saved_tasks = tres.data or []
    return {"plan": saved_plan, "tasks": saved_tasks}


def list_plans(startup_id: str, limit: int = 20) -> list[dict]:
    res = service_supabase.table("war_room_plans").select("*").eq("startup_id", startup_id).order("created_at", desc=True).limit(limit).execute()
    plans = res.data or []
    for p in plans:
        t = service_supabase.table("war_room_tasks").select("id", count="exact").eq("plan_id", p["id"]).execute()
        done = service_supabase.table("war_room_tasks").select("id", count="exact").eq("plan_id", p["id"]).eq("status", "done").execute()
        p["task_count"] = int(t.count or 0)
        p["done_count"] = int(done.count or 0)
    return plans


def get_plan(plan_id: str) -> Optional[dict]:
    res = service_supabase.table("war_room_plans").select("*").eq("id", plan_id).limit(1).execute()
    if not res.data:
        return None
    plan = res.data[0]
    tasks = service_supabase.table("war_room_tasks").select("*").eq("plan_id", plan_id).order("sort_order", asc=True).execute()
    plan["tasks"] = tasks.data or []
    return plan


def create_task(startup_id: str, created_by: str, data: dict) -> dict:
    row = {
        "plan_id": data.get("plan_id"),
        "startup_id": startup_id,
        "created_by": created_by,
        "title": data.get("title") or "Untitled task",
        "description": data.get("description") or "",
        "goal": data.get("goal") or "",
        "priority": data.get("priority") or "medium",
        "assigned_role": data.get("assigned_role") or "founder",
        "assignee_id": data.get("assignee_id"),
        "deadline": data.get("deadline"),
        "status": data.get("status") or "todo",
    }
    res = service_supabase.table("war_room_tasks").insert(row).execute()
    return (res.data or [row])[0]


def update_task(task_id: str, data: dict) -> Optional[dict]:
    res = service_supabase.table("war_room_tasks").select("*").eq("id", task_id).limit(1).execute()
    if not res.data:
        return None
    allowed = {k: v for k, v in data.items() if v is not None and k in (
        "title", "description", "goal", "priority", "assigned_role", "assignee_id", "deadline", "status", "sort_order")}
    if not allowed:
        return res.data[0]
    allowed["updated_at"] = datetime.now(timezone.utc).isoformat()
    ures = service_supabase.table("war_room_tasks").update(allowed).eq("id", task_id).execute()
    return (ures.data or [res.data[0]])[0]


def delete_insight(insight_id: str) -> bool:
    try:
        service_supabase.table("war_room_insights").delete().eq("id", insight_id).execute()
        return True
    except Exception:
        return False


# ---------------------------------------------------------------------------
# Insights (deterministic + AI enrichment)
# ---------------------------------------------------------------------------

def deterministic_insights(sd: dict) -> list[dict]:
    """Insights derived ONLY from real scores/data."""
    s = sd["startup"]
    out: list[dict] = []

    h = si.score_health(sd)
    r = si.score_investor_readiness(sd)
    g = si.score_team_gaps(sd)

    if h.get("score") is not None:
        if h["score"] >= 70:
            out.append({"insight_type": "opportunity", "title": f"Health score {h['score']}/100", "detail": "Your startup health is strong. Double down on what is working."})
        elif h["score"] < 50:
            out.append({"insight_type": "risk", "title": f"Health score {h['score']}/100", "detail": "Your startup health needs urgent attention. Prioritize the weakest sections."})
        else:
            out.append({"insight_type": "warning", "title": f"Health score {h['score']}/100", "detail": "Health is average — close the biggest gaps to accelerate."})

    if r.get("score") is not None:
        if r["score"] < 60:
            out.append({"insight_type": "warning", "title": f"Investor Readiness {r['score']}%", "detail": "Your financial projections are incomplete or your investor materials need work."})
        else:
            out.append({"insight_type": "opportunity", "title": f"Investor Readiness {r['score']}%", "detail": "You are reasonably investor-ready. Polish the pitch and start outreach."})

    for cat in (h.get("categories") or []):
        if cat.get("key") == "financials" and (cat.get("score") or 0) < 50:
            out.append({"insight_type": "warning", "title": "Financials incomplete", "detail": "Add a funding ask, cap table and financial projections."})
        if cat.get("key") == "traction" and (cat.get("score") or 0) < 50:
            out.append({"insight_type": "warning", "title": "Traction signals weak", "detail": "Collect applications and evidence of demand to build credibility."})

    if not (s.get("description") or "").strip() or len((s.get("description") or "").strip()) < 100:
        out.append({"insight_type": "risk", "title": "Weak startup profile", "detail": "Your startup profile is missing key investor information (description, tagline, industry)."})
    if not s.get("team_roles_needed"):
        out.append({"insight_type": "recommendation", "title": "Define needed roles", "detail": "Set team_roles_needed so AI Matches can find the right people."})

    for gap in (g.get("gaps") or [])[:3]:
        out.append({"insight_type": "recommendation", "title": f"Team gap: {gap.get('label')}", "detail": gap.get("why") or f"Fill the {gap.get('role')} role via AI Matches."})

    if not sd.get("documents"):
        out.append({"insight_type": "recommendation", "title": "Open your Data Room", "detail": "Upload financial, legal, product and pitch documents so investors can do diligence."})
    return out


async def _ai_insight_enrichment(user_id: str, sd: dict, deterministic: list[dict]) -> list[dict]:
    """AI adds a few more insights; never invents numbers."""
    data = si._summarize_startup(sd)
    det_summary = json.dumps([{"type": d["insight_type"], "title": d["title"]} for d in deterministic], default=str)[:800]
    prompt = (
        "You are a startup advisor. Based ONLY on the following real data (never invent metrics not listed), "
        "add 3-5 concise strategic insights for the founder. Label each as opportunity, warning, risk or recommendation.\n\n"
        f"DATA:\n{data}\n\nEXISTING INSIGHTS (do not duplicate):\n{det_summary}\n\n"
        "Return STRICT JSON only:\n"
        '{"insights": [{"insight_type": "opportunity|warning|risk|recommendation", "title": "short title", "detail": "one-line detail"}]}'
    )
    t0 = time.time()
    try:
        text = await asyncio.to_thread(generate_text_sync, user_id, prompt)
        parsed = json.loads(text)
        rows = parsed.get("insights") or []
        out = []
        for r in rows[:5]:
            if not isinstance(r, dict) or not r.get("title"):
                continue
            out.append({
                "insight_type": str(r.get("insight_type") or "recommendation").lower()
                if str(r.get("insight_type") or "").lower() in ("opportunity", "warning", "risk", "recommendation") else "recommendation",
                "title": str(r["title"])[:200],
                "detail": str(r.get("detail") or "")[:500],
            })
        log_ai_usage(user_id, "war_room_insights", "success", duration_ms=int((time.time() - t0) * 1000))
        return out
    except Exception as exc:
        print(f"[war_room] AI insights skipped: {exc}")
        log_ai_usage(user_id, "war_room_insights", "failed", error=str(exc)[:300], duration_ms=int((time.time() - t0) * 1000))
        return []


def save_insights(startup_id: str, created_by: str, insights: list[dict]) -> list[dict]:
    rows = [{
        "startup_id": startup_id,
        "created_by": created_by,
        "insight_type": i["insight_type"],
        "title": i["title"],
        "detail": i.get("detail") or "",
    } for i in insights]
    if not rows:
        return []
    res = service_supabase.table("war_room_insights").insert(rows).execute()
    return res.data or []
