"""AI Business Plan Generator — CRUD, generation, share and export endpoints."""
from __future__ import annotations

import asyncio
import threading
import time
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.core.auth import get_user_id
from app.core.supabase import service_supabase
from app.services.business_plan_generator import generate_business_plan, new_share_token
from app.services.business_plan_pdf import (
    _plan_idea,
    _plan_name,
    render_business_plan_markdown,
    render_business_plan_pdf,
)
from app.services.docx_writer import DocxWriter

router = APIRouter(prefix="/api/business-plan", tags=["business-plan"])

STAGES = {"idea", "mvp", "traction", "growth", "scale"}
MODELS = {"saas", "marketplace", "ecommerce", "subscription", "ads", "agency", "hardware", "consulting", "fintech", "other"}

# Simple in-memory per-user rate limit for generation (5/hour).
_RATE: dict[str, list[float]] = {}
_RATE_LIMIT = threading.Lock()
_MAX_GENERATIONS_PER_HOUR = 5


class GeneratePlanRequest(BaseModel):
    startup_name: str = Field(min_length=1, max_length=120)
    idea: str = Field(min_length=10, max_length=8000)
    industry: Optional[str] = None
    country: Optional[str] = None
    target_audience: Optional[str] = None
    stage: Optional[str] = "idea"
    funding_goal: Optional[int] = Field(default=0, ge=0, le=10**12)
    budget: Optional[int] = Field(default=0, ge=0, le=10**9)
    team_size: Optional[int] = Field(default=1, ge=1, le=500)
    business_model: Optional[str] = "other"


class UpdatePlanRequest(BaseModel):
    startup_name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    business_plan: Optional[list] = None
    pitch_deck: Optional[list] = None
    is_public: Optional[bool] = None


class ExportRequest(BaseModel):
    format: str = "pdf"


def _check_rate_limit(user_id: str) -> None:
    now = time.monotonic()
    with _RATE_LIMIT:
        timestamps = [t for t in _RATE.get(user_id, []) if now - t < 3600]
        if len(timestamps) >= _MAX_GENERATIONS_PER_HOUR:
            raise HTTPException(
                status_code=429,
                detail="You have reached the limit of 5 generated business plans per hour. Please try again later.",
            )
        timestamps.append(now)
        _RATE[user_id] = timestamps


def _get_owner_plan(plan_id: str, user_id: str) -> dict:
    try:
        result = (
            service_supabase.table("business_plans")
            .select("*")
            .eq("id", plan_id)
            .eq("user_id", user_id)
            .maybe_single()
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to load business plan: {exc}") from exc
    if not result.data:
        raise HTTPException(status_code=404, detail="Business plan not found")
    return result.data


def _get_plan_by_token(token: str) -> dict:
    try:
        result = (
            service_supabase.table("business_plans")
            .select("*")
            .eq("share_token", token)
            .maybe_single()
            .execute()
        )
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=400, detail=f"Failed to load business plan: {exc}") from exc
    if not result.data:
        raise HTTPException(status_code=404, detail="Business plan not found")
    return result.data


def _summary(row: dict) -> dict:
    readiness = row.get("investor_readiness") or {}
    return {
        "id": row["id"],
        "startup_name": row.get("startup_name"),
        "industry": (row.get("inputs") or {}).get("industry"),
        "stage": (row.get("inputs") or {}).get("stage"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
        "readiness": readiness.get("overall"),
        "readiness_label": readiness.get("label"),
        "is_public": bool(row.get("is_public")),
        "share_token": row.get("share_token"),
        "provider": row.get("provider"),
    }


# ---------------------------------------------------------------------------
# Generation
# ---------------------------------------------------------------------------

@router.post("/generate")
async def generate(payload: GeneratePlanRequest, user_id: str = Depends(get_user_id)):
    if payload.stage not in STAGES:
        raise HTTPException(status_code=400, detail="Invalid stage")
    if payload.business_model not in MODELS:
        raise HTTPException(status_code=400, detail="Invalid business model")
    _check_rate_limit(user_id)

    try:
        plan, provider = await asyncio.to_thread(
            generate_business_plan,
            user_id,
            payload.startup_name,
            payload.idea,
            industry=payload.industry,
            country=payload.country,
            target_audience=payload.target_audience,
            stage=payload.stage,
            funding_goal=payload.funding_goal or 0,
            budget=payload.budget or 0,
            team_size=payload.team_size or 1,
            business_model=payload.business_model,
        )
    except HTTPException:
        raise
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"Generation failed: {exc}") from exc

    record = {
        "user_id": user_id,
        "startup_name": payload.startup_name,
        "idea": payload.idea,
        "inputs": plan["inputs"],
        "business_plan": plan["business_plan"],
        "pitch_deck": plan["pitch_deck"],
        "financial_projection": plan["financial_projection"],
        "team_recommendations": plan["team_recommendations"],
        "investor_readiness": plan["investor_readiness"],
        "ai_recommendations": plan["ai_recommendations"],
        "share_token": new_share_token(),
        "is_public": True,
        "provider": provider,
    }
    result = service_supabase.table("business_plans").insert(record).execute()
    row = result.data[0]
    row["provider"] = provider
    return row


# ---------------------------------------------------------------------------
# List & detail
# ---------------------------------------------------------------------------

@router.get("")
async def list_plans(user_id: str = Depends(get_user_id)):
    result = (
        service_supabase.table("business_plans")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )
    rows = result.data or []
    return {"plans": [_summary(r) for r in rows]}


@router.get("/share/{token}")
async def share_view(token: str):
    row = _get_plan_by_token(token)
    row["share_token"] = None
    return row


@router.get("/{plan_id}")
async def get_plan(plan_id: str, user_id: str = Depends(get_user_id)):
    return _get_owner_plan(plan_id, user_id)


# ---------------------------------------------------------------------------
# Update & delete
# ---------------------------------------------------------------------------

@router.patch("/{plan_id}")
async def update_plan(plan_id: str, payload: UpdatePlanRequest, user_id: str = Depends(get_user_id)):
    plan = _get_owner_plan(plan_id, user_id)
    updates = {k: v for k, v in payload.dict().items() if v is not None}
    if not updates:
        return plan
    service_supabase.table("business_plans").update(updates).eq("id", plan_id).execute()
    return _get_owner_plan(plan_id, user_id)


@router.delete("/{plan_id}")
async def delete_plan(plan_id: str, user_id: str = Depends(get_user_id)):
    _get_owner_plan(plan_id, user_id)
    service_supabase.table("business_plans").delete().eq("id", plan_id).execute()
    return {"success": True}


# ---------------------------------------------------------------------------
# Exports
# ---------------------------------------------------------------------------

@router.post("/{plan_id}/export")
async def export_plan(plan_id: str, payload: ExportRequest, user_id: str = Depends(get_user_id)):
    plan = _get_owner_plan(plan_id, user_id)
    fmt = (payload.format or "pdf").lower()
    filename = (plan.get("startup_name") or "business_plan").lower().replace(" ", "_").replace("/", "_")

    if fmt == "pdf":
        content = await asyncio.to_thread(render_business_plan_pdf, plan)
        return Response(
            content=content,
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}_business_plan.pdf"',
                "Cache-Control": "no-store",
            },
        )

    if fmt == "docx":
        docx = await asyncio.to_thread(_render_docx, plan)
        return Response(
            content=docx,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}_business_plan.docx"',
                "Cache-Control": "no-store",
            },
        )

    if fmt == "markdown":
        md = render_business_plan_markdown(plan)
        return Response(
            content=md.encode("utf-8"),
            media_type="text/markdown; charset=utf-8",
            headers={
                "Content-Disposition": f'attachment; filename="{filename}_business_plan.md"',
                "Cache-Control": "no-store",
            },
        )

    raise HTTPException(status_code=400, detail="Format must be one of: pdf, docx, markdown")


def _render_docx(plan: dict) -> bytes:
    d = DocxWriter()
    d.add_title(_plan_name(plan))
    if _plan_idea(plan):
        d.add_subtitle(_plan_idea(plan))
    d.add_paragraph("")
    inputs = plan.get("inputs") or {}
    meta = [
        f"Industry: {inputs.get('industry') or '—'}",
        f"Country: {inputs.get('country') or '—'}",
        f"Stage: {inputs.get('stage') or '—'}",
        f"Business model: {inputs.get('business_model') or '—'}",
        f"Team size: {inputs.get('team_size') or 1}",
        f"Funding goal: ${int(inputs.get('funding_goal') or 0):,}",
    ]
    d.add_paragraph("\n".join(meta))

    readiness = plan.get("investor_readiness") or {}
    d.add_heading(f"Investor Readiness: {readiness.get('overall', 0)}/100 ({readiness.get('label') or ''})", 1)

    for section in plan.get("business_plan") or []:
        d.add_heading(section.get("title") or section.get("key") or "", 1)
        content = section.get("content") or ""
        for block in content.split("\n\n"):
            lines = block.split("\n")
            if lines and all(l.lstrip().startswith("-") for l in lines if l.strip()):
                d.add_bullets([l.lstrip().lstrip("- ").strip() for l in lines if l.strip()])
            else:
                for line in lines:
                    if line.strip():
                        d.add_paragraph(line)

    d.add_page_break()
    d.add_heading("Pitch Deck", 1)
    for slide in plan.get("pitch_deck") or []:
        d.add_heading(slide.get("title") or "", 2)
        d.add_bullets(slide.get("bullets") or [])
        if slide.get("note"):
            d.add_paragraph(f"Speaker note: {slide['note']}")

    fin = plan.get("financial_projection") or {}
    d.add_page_break()
    d.add_heading("Financial Projection", 1)
    d.add_paragraph(
        f"Year-1 revenue: ${int(fin.get('year1_revenue') or 0):,}\n"
        f"Year-3 revenue: ${int(fin.get('year3_revenue') or 0):,}\n"
        f"Monthly burn: ${int(fin.get('monthly_budget') or 0):,}\n"
        f"Break-even: {'Month %s' % fin['break_even_month'] if fin.get('break_even_month') else 'Beyond 12 months'}"
    )
    headers = ["Month", "Revenue", "Expenses", "Cash flow", "Cumulative"]
    rows = []
    revenue = fin.get("monthly_revenue") or []
    expenses = fin.get("monthly_expenses") or []
    cash_flow = fin.get("monthly_cash_flow") or []
    cumulative = fin.get("cumulative_cash") or []
    for i in range(len(revenue)):
        rows.append([
            f"M{i+1}", f"${revenue[i]:,}", f"${(expenses[i] if i < len(expenses) else 0):,}",
            f"${(cash_flow[i] if i < len(cash_flow) else 0):,}", f"${(cumulative[i] if i < len(cumulative) else 0):,}",
        ])
    d.add_table(headers, rows)

    d.add_heading("Team Recommendations", 1)
    d.add_table(
        ["Role", "Seniority", "#", "Remote", "Why"],
        [[str(r.get("role") or ""), str(r.get("seniority") or ""), str(r.get("count") or 1),
          "Yes" if r.get("remote_ok") else "No", str(r.get("reason") or "")] for r in plan.get("team_recommendations") or []],
    )

    d.add_heading("AI Recommendations", 1)
    labels = [("missing_features", "Missing features"), ("weaknesses", "Weaknesses"), ("improvements", "Improvements"),
              ("risks", "Risks"), ("scaling_plan", "Scaling plan"), ("internationalization", "Internationalization")]
    for key, title in labels:
        items = (plan.get("ai_recommendations") or {}).get(key) or []
        if items:
            d.add_heading(title, 2)
            d.add_bullets(items)

    d.add_paragraph("")
    d.add_paragraph("_Generated by FounderHub AI Business Plan Generator._")
    return d.build()
