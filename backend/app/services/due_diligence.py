"""AI Due-Diligence service — deterministic scoring + AI-enriched narrative.

Design rules (mirror app/services/startup_insights.py):
- ALL 10 section scores are computed deterministically from REAL database data.
  The AI never produces numbers; it only enriches qualitative narrative.
- PRIVACY: private Data Room documents are ONLY included when the investor has
  an active, valid access grant for that startup's data room. Otherwise the
  documents list is empty and the report reports "Insufficient data" for
  document-dependent sections. No private document is ever exposed.
- If the startup has too little data the report returns insufficient=True.
- Reports are cached per (investor, startup); "Refresh Analysis" regenerates.
"""
from __future__ import annotations

import asyncio
import json
import time
from datetime import datetime, timezone
from typing import Optional

from app.core.supabase import service_supabase
from app.api.ai import generate_text_sync
from app.services import startup_insights as si

CACHE_TTL_SECONDS = 6 * 60 * 60

DD_SECTIONS = [
    "market_opportunity",
    "business_model",
    "product",
    "traction",
    "team",
    "competition",
    "financial_readiness",
    "growth_potential",
    "risk_analysis",
    "investor_readiness",
]

DD_WEIGHTS = {
    "market_opportunity": 10,
    "business_model": 10,
    "product": 12,
    "traction": 12,
    "team": 14,
    "competition": 8,
    "financial_readiness": 12,
    "growth_potential": 8,
    "risk_analysis": 6,
    "investor_readiness": 8,
}


def log_ai_usage(user_id: str, tool_slug: str, status: str, error: str = "",
                 duration_ms: Optional[int] = None, role: Optional[str] = None) -> None:
    """Append a row to ai_usage_logs for admin monitoring (best-effort)."""
    try:
        service_supabase.table("ai_usage_logs").insert({
            "user_id": user_id,
            "tool_slug": tool_slug,
            "status": status,
            "error": error or "",
            "duration_ms": duration_ms,
            "role": role,
        }).execute()
    except Exception as exc:
        print(f"[ai_usage] failed to log {tool_slug}: {exc}")


def _investor_access(startup_id: str, investor_id: str) -> dict:
    """Check the investor's data-room access for a startup (privacy gate)."""
    result = {
        "has_data_room": False,
        "has_access": False,
        "request_status": None,
        "access_level": None,
        "doc_categories": [],
    }
    try:
        room = (
            service_supabase.table("data_rooms")
            .select("*")
            .eq("startup_id", startup_id)
            .limit(1)
            .execute()
        )
        if not room.data:
            return result
        dr = room.data[0]
        result["has_data_room"] = True

        access = (
            service_supabase.table("data_room_access")
            .select("*")
            .eq("data_room_id", dr["id"])
            .eq("user_id", investor_id)
            .limit(1)
            .execute()
        )
        acc = (access.data or [None])[0]
        if acc and acc.get("is_active"):
            expires = acc.get("expires_at")
            if not expires or datetime.fromisoformat(str(expires).replace("Z", "+00:00")) > datetime.now(timezone.utc):
                if not (dr.get("require_nda") and not acc.get("nda_signed")):
                    result["has_access"] = True
                    result["access_level"] = acc.get("access_level")

        req = (
            service_supabase.table("data_room_access_requests")
            .select("status")
            .eq("data_room_id", dr["id"])
            .eq("requester_id", investor_id)
            .limit(1)
            .execute()
        )
        if req.data:
            result["request_status"] = req.data[0].get("status")

        if result["has_access"]:
            docs = (
                service_supabase.table("data_room_documents")
                .select("category")
                .eq("data_room_id", dr["id"])
                .execute()
            )
            result["doc_categories"] = sorted({(d.get("category") or "").lower() for d in (docs.data or [])})
    except Exception as exc:
        print(f"[due_diligence] access check failed for {startup_id}: {exc}")
    return result


def collect_dd_data(startup_id: str, investor_id: str) -> Optional[dict]:
    """Startup data for due diligence, with the privacy gate applied."""
    sd = si.collect_startup_data(startup_id)
    if not sd:
        return None
    access = _investor_access(startup_id, investor_id)

    # PRIVACY: only authorized documents enter the analysis.
    if not access["has_access"]:
        sd["documents"] = []
        sd["doc_categories"] = []
    else:
        sd["doc_categories"] = access["doc_categories"]

    sd["dd_access"] = access
    return sd


def _pct(value: int, total: int) -> int:
    if total <= 0:
        return 0
    return max(0, min(100, round(value * 100 / total)))


def _note(score: int, base: str) -> str:
    if score >= 70:
        return f"{base} This area looks solid."
    if score >= 40:
        return f"{base} Some gaps remain."
    return f"{base} Significant work needed here."


def score_due_diligence(sd: dict) -> dict:
    """Deterministic 10-section scoring. No AI, no invented numbers."""
    s = sd["startup"]
    founder = sd.get("founder") or {}
    members = sd.get("members") or []
    apps = sd.get("applications") or []
    accepted = sd.get("accepted_applications") or []
    docs = sd.get("documents") or []
    cats = sd.get("doc_categories") or []
    bp = sd.get("business_plan") or {}
    cap = sd.get("cap_table")
    access = sd.get("dd_access") or {}
    desc_len = len((s.get("description") or "").strip())

    # 1. Market Opportunity
    market = _pct(
        (30 if (s.get("industry") or "").strip() else 0)
        + (20 if s.get("stage") else 0)
        + (25 if desc_len >= 300 else 10 if desc_len >= 100 else 0)
        + (15 if (s.get("website_url") or "").strip() else 0)
        + (10 if s.get("is_verified") else 0),
        100,
    )
    market_note = _note(market, "Industry, stage, positioning and a live web presence shape the market story.")

    # 2. Business Model
    business_model = _pct(
        (30 if bp.get("business_plan") else 0)
        + (25 if (s.get("industry") or "").strip() else 0)
        + (20 if (s.get("website_url") or "").strip() else 0)
        + (15 if (s.get("funding_needed") or "").strip() else 0)
        + (10 if s.get("is_verified") else 0),
        100,
    )
    business_model_note = _note(business_model, "A business plan, positioning and a funding ask make the model reviewable.")

    # 3. Product
    product = _pct(
        (40 if desc_len >= 300 else 25 if desc_len >= 100 else 10 if desc_len > 0 else 0)
        + (20 if s.get("tech_stack") else 0)
        + (20 if s.get("website_url") else 0)
        + (20 if s.get("pitch_deck_url") else 0),
        100,
    )
    product_note = _note(product, "Product detail, tech stack, website and pitch deck.")

    # 4. Traction
    traction = _pct(
        (40 if apps else 0)
        + (25 if accepted else 0)
        + (20 if s.get("is_verified") else 0)
        + (15 if bp.get("business_plan") else 0),
        100,
    )
    traction_note = _note(traction, "Applications, accepted members and verification are the only real demand signals available.")

    # 5. Team
    team = _pct(
        (25 if founder else 0)
        + (25 if (founder.get("experience_years") or 0) >= 3 else 10 if founder else 0)
        + (25 if members else 0)
        + (25 if len(members) >= 3 or s.get("team_roles_needed") else 0),
        100,
    )
    team_note = _note(team, "Founder depth, team members and defined roles.")

    # 6. Competition
    competition = _pct(
        (35 if desc_len >= 300 else 10 if desc_len >= 100 else 0)
        + (30 if (s.get("industry") or "").strip() else 0)
        + (20 if s.get("is_verified") else 0)
        + (15 if bp.get("business_plan") else 0),
        100,
    )
    competition_note = _note(competition, "Competition is inferred from description and industry; no dedicated competitive analysis exists.")

    # 7. Financial Readiness
    financials = _pct(
        (30 if s.get("funding_needed") else 0)
        + (20 if s.get("equity_offered") is not None else 0)
        + (30 if cap else 0)
        + (20 if bp.get("financial_projection") else 0),
        100,
    )
    financials_note = _note(financials, "Funding ask, equity offered, cap table and financial projections.")

    # 8. Growth Potential
    growth = _pct(
        (30 if s.get("stage") in ("mvp", "growth", "scaling") else 10 if s.get("stage") else 0)
        + (25 if accepted else 10 if apps else 0)
        + (20 if s.get("is_verified") else 0)
        + (15 if (s.get("remote_friendly") or s.get("location")) else 0)
        + (10 if (s.get("industry") or "").strip() else 0),
        100,
    )
    growth_note = _note(growth, "Stage, demand signals, verification and reach combine into a growth view.")

    # 9. Risk Analysis (inverse of the visible evidence)
    risk_score = _pct(
        (35 if founder and (founder.get("experience_years") or 0) >= 3 else 0)
        + (25 if members else 0)
        + (20 if cap else 0)
        + (20 if (s.get("funding_needed") or "").strip() and bp.get("financial_projection") else 0),
        100,
    )
    risk_analysis = 100 - risk_score  # higher risk score = more red flags
    risk_analysis_note = _note(risk_analysis, "Inverted evidence check: missing founder depth, team, cap table or projections raise risk.")

    # 10. Investor Readiness
    investor_readiness = _pct(
        (30 if s.get("pitch_deck_url") else 0)
        + (20 if cap else 0)
        + (20 if (s.get("funding_needed") or "").strip() and s.get("equity_offered") is not None else 0)
        + (15 if bp.get("financial_projection") else 0)
        + (15 if s.get("is_verified") else 0),
        100,
    )
    investor_readiness_note = _note(investor_readiness, "Pitch deck, cap table, funding ask and projections make a startup fundable.")

    # Data-room dependent bonus: if the investor has access, reflect real docs.
    if access.get("has_access"):
        data_room_score = _pct(min(50, 10 * len(cats)) + (20 if "financials" in cats else 0)
                               + (15 if "legal" in cats else 0) + (15 if "pitch_deck" in cats else 0), 100)
        if "pitch_deck" in cats:
            investor_readiness = min(100, investor_readiness + 15)
        if "financials" in cats:
            financials = min(100, financials + 15)
    else:
        data_room_score = None

    sections = [
        {"key": "market_opportunity", "label": "Market Opportunity", "score": market, "max": 100, "note": market_note},
        {"key": "business_model", "label": "Business Model", "score": business_model, "max": 100, "note": business_model_note},
        {"key": "product", "label": "Product", "score": product, "max": 100, "note": product_note},
        {"key": "traction", "label": "Traction", "score": traction, "max": 100, "note": traction_note},
        {"key": "team", "label": "Team", "score": team, "max": 100, "note": team_note},
        {"key": "competition", "label": "Competition", "score": competition, "max": 100, "note": competition_note},
        {"key": "financial_readiness", "label": "Financial Readiness", "score": financials, "max": 100, "note": financials_note},
        {"key": "growth_potential", "label": "Growth Potential", "score": growth, "max": 100, "note": growth_note},
        {"key": "risk_analysis", "label": "Risk Analysis", "score": risk_analysis, "max": 100, "note": risk_analysis_note},
        {"key": "investor_readiness", "label": "Investor Readiness", "score": investor_readiness, "max": 100, "note": investor_readiness_note},
    ]

    overall = round(sum(sec["score"] * DD_WEIGHTS[sec["key"]] for sec in sections) / 100)
    risk_level = "LOW" if overall >= 75 else "MEDIUM" if overall >= 55 else "HIGH"

    strengths = [{"title": sec["label"], "detail": sec["note"]} for sec in sections if sec["score"] >= 70]
    weaknesses = [{"title": sec["label"], "detail": sec["note"]} for sec in sections if sec["score"] < 50]

    risks = []
    if not founder or (founder.get("experience_years") or 0) < 3:
        risks.append({"title": "Thin founding evidence", "detail": "Limited founder profile or experience on record."})
    if not members:
        risks.append({"title": "Solo founder exposure", "detail": "No team members are attached to this startup yet."})
    if not cap:
        risks.append({"title": "No cap table", "detail": "Ownership structure is not documented."})
    if not bp.get("financial_projection"):
        risks.append({"title": "No financial projections", "detail": "Unit economics and runway cannot be validated."})
    if not access.get("has_access") and access.get("has_data_room"):
        risks.append({"title": "Private documents not reviewed", "detail": "Data room access is required to verify financial/legal documents."})

    missing = [f for f in si.COVERAGE_FIELDS if f not in (sd and si.coverage_report(sd).get("available") or [])]
    if access.get("has_data_room") and not access.get("has_access"):
        missing.append("authorized_data_room")

    questions = [
        "What is your unit economics and gross margin?",
        "What does your 12-month runway look like?",
        "Who are your top 3 competitors and how do you differentiate?",
        "What are your top 3 acquisition channels and CAC?",
        "What is the current monthly revenue and growth rate?",
        "What milestone will you hit with this funding round?",
    ]
    if not access.get("has_access") and access.get("has_data_room"):
        questions.insert(0, "Request data room access to verify financial, legal and cap-table documents.")

    next_steps = [
        "Request data room access to verify private documents.",
        "Message the founder with the questions above.",
        "Schedule a meeting to discuss traction and unit economics.",
        "Monitor the startup for 2-4 weeks before committing.",
    ]
    if not access.get("has_data_room"):
        next_steps[0] = "Ask the founder to open a data room for deeper diligence."

    return {
        "score": overall,
        "risk_level": risk_level,
        "sections": sections,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "risks": risks,
        "missing_info": missing,
        "questions": questions,
        "next_steps": next_steps,
        "data_room_score": data_room_score,
        "summary": f"{s.get('name') or 'This startup'} scores {overall}/100 on due diligence with {risk_level} risk.",
    }


async def _ai_narrative(sd: dict, user_id: str, deterministic: dict) -> dict:
    """AI narrative enrichment — qualitative only, never invents numbers."""
    data = si._summarize_startup(sd)
    if not deterministic.get("has_dd_access"):
        data += "\n[Note: investor does NOT have data room access — private documents were not reviewed]"
    prompt = (
        "You are an experienced angel/VC due-diligence analyst. Based ONLY on the following real data, "
        "write a professional investor report narrative. NEVER invent financial numbers, revenue, users, "
        "customers or company facts that are not listed. Where information is unavailable, say so.\n\n"
        f"DATA:\n{data}\n\n"
        "Return STRICT JSON only with exactly these keys (all strings):\n"
        '{"summary": "3-4 sentence overall investor summary referencing real facts", '
        '"why_score": "2-3 sentences explaining the overall score", '
        '"sector_notes": {"market_opportunity": "...", "business_model": "...", "product": "...", "traction": "...", "team": "...", "competition": "...", "financial_readiness": "...", "growth_potential": "...", "risk_analysis": "...", "investor_readiness": "..."}}'
    )
    t0 = time.time()
    try:
        text = await asyncio.to_thread(generate_text_sync, user_id, prompt)
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            return {}
        keep = {k: v for k, v in parsed.items() if k in ("summary", "why_score", "sector_notes") and isinstance(v, str) or k == "sector_notes" and isinstance(v, dict)}
        log_ai_usage(user_id, "due_diligence", "success", duration_ms=int((time.time() - t0) * 1000))
        return keep
    except Exception as exc:
        print(f"[due_diligence] AI narrative skipped: {exc}")
        log_ai_usage(user_id, "due_diligence", "failed", error=str(exc)[:300], duration_ms=int((time.time() - t0) * 1000))
        return {}


def _apply_narrative(result: dict, narrative: dict) -> dict:
    if narrative.get("summary"):
        result["summary"] = narrative["summary"]
    if narrative.get("why_score"):
        result["why_score"] = narrative["why_score"]
    notes = narrative.get("sector_notes") or {}
    if notes and result.get("sections"):
        for sec in result["sections"]:
            if sec["key"] in notes:
                sec["note"] = f"{sec['note']} {notes[sec['key']]}".strip()
    return result


def fetch_cached(investor_id: str, startup_id: str) -> Optional[dict]:
    try:
        res = service_supabase.table("due_diligence_reports").select("*").eq("investor_id", investor_id).eq("startup_id", startup_id).limit(1).execute()
        return (res.data or [None])[0]
    except Exception:
        return None


def fresh(row: Optional[dict], refresh: bool) -> bool:
    if refresh or not row:
        return False
    try:
        created = row.get("updated_at") or row.get("created_at")
        if not created:
            return False
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(str(created).replace("Z", "+00:00"))).total_seconds()
        return age < CACHE_TTL_SECONDS
    except Exception:
        return False


def save_report(row: dict) -> dict:
    try:
        res = service_supabase.table("due_diligence_reports").upsert(
            row, on_conflict="investor_id,startup_id"
        ).execute()
        return (res.data or [row])[0]
    except Exception as exc:
        print(f"[due_diligence] failed to save report: {exc}")
        return row
