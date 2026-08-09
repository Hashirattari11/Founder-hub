"""AI Startup Insights — data-driven scoring + AI-enriched narrative.

Design rules (per product spec):
- ALL scores are computed deterministically from REAL data in the database.
  The AI never produces numbers; it only enriches qualitative narrative
  (summary, notes, wording). This keeps every metric explainable and honest.
- If a startup has too little data, the analysis returns `insufficient=True`
  with a data-coverage report (what's missing) instead of inventing a score.
- Results are cached in DB tables; "Analyze Again" forces a refresh.
"""
from __future__ import annotations

import asyncio
import json
from typing import Optional

from app.core.supabase import service_supabase
from app.api.ai import generate_text_sync

# Cache lifetime for analyses (seconds). Analyze Again bypasses this.
CACHE_TTL_SECONDS = 6 * 60 * 60

# Deterministic role -> skills / responsibilities templates used for team-gap
# suggestions. These are labelled suggestions, not fabricated user data.
ROLE_KNOWLEDGE: dict[str, dict] = {
    "developer": {
        "label": "Developer",
        "skills": ["python", "react", "typescript", "nodejs", "sql", "aws", "api design"],
        "responsibilities": ["Build the product", "Own the tech stack", "Ship features fast", "Code review & architecture"],
    },
    "designer": {
        "label": "Designer",
        "skills": ["ui design", "ux research", "figma", "prototyping", "design systems", "branding"],
        "responsibilities": ["Design the product experience", "Build the design system", "Prototype & user-test", "Own the brand look"],
    },
    "marketer": {
        "label": "Marketer",
        "skills": ["growth marketing", "seo", "content", "social media", "paid ads", "email marketing"],
        "responsibilities": ["Own go-to-market", "Acquire first customers", "Run growth experiments", "Build the brand voice"],
    },
    "investor": {
        "label": "Investor",
        "skills": ["due diligence", "valuation", "portfolio management", "financing", "networking"],
        "responsibilities": ["Evaluate & fund the startup", "Provide capital", "Open network doors", "Advise on strategy"],
    },
    "legal_advisor": {
        "label": "Legal Advisor",
        "skills": ["incorporation", "contracts", "ip protection", "compliance", "terms of service"],
        "responsibilities": ["Incorporation & filings", "Review contracts", "IP & trademark protection", "Compliance guidance"],
    },
    "business_analyst": {
        "label": "Business Analyst",
        "skills": ["market research", "financial modeling", "data analysis", "unit economics", "competitor analysis"],
        "responsibilities": ["Market sizing", "Financial modeling", "KPI dashboards", "Competitor research"],
    },
    "mentor": {
        "label": "Mentor",
        "skills": ["startup coaching", "product strategy", "leadership", "pitching", "fundraising"],
        "responsibilities": ["Coach the founder", "Review strategy", "Open network doors", "Hold the founder accountable"],
    },
    "recruiter": {
        "label": "Recruiter",
        "skills": ["talent sourcing", "hiring", "interviewing", "employer branding", "networking"],
        "responsibilities": ["Source talent", "Screen candidates", "Run hiring process", "Build the team pipeline"],
    },
}

ALL_ROLES = ["founder", "developer", "designer", "marketer", "investor",
             "legal_advisor", "business_analyst", "mentor", "recruiter", "administrator"]

COVERAGE_FIELDS = [
    "description", "tagline", "industry", "stage", "tech_stack", "team_roles_needed",
    "founder_profile", "team_members", "applications", "business_plan",
    "data_room", "cap_table", "pitch_deck",
]


# ---------------------------------------------------------------------------
# Data collection (reads real rows via the service role)
# ---------------------------------------------------------------------------

def _first(table: str, query: dict) -> Optional[dict]:
    try:
        q = service_supabase.table(table).select("*")
        for k, v in query.items():
            q = q.eq(k, v)
        res = q.limit(1).execute()
        return (res.data or [None])[0]
    except Exception:
        return None


def _many(table: str, query: dict, limit: int = 200) -> list[dict]:
    try:
        q = service_supabase.table(table).select("*")
        for k, v in query.items():
            q = q.eq(k, v)
        res = q.limit(limit).execute()
        return res.data or []
    except Exception:
        return []


def collect_startup_data(startup_id: str) -> Optional[dict]:
    """Gather every real data point used by the three analyzers."""
    startup = _first("startups", {"id": startup_id})
    if not startup:
        return None

    founder = _first("profiles", {"id": startup.get("founder_id")})

    members = []
    try:
        rows = _many("startup_members", {"startup_id": startup_id})
        member_ids = [r["user_id"] for r in rows if r.get("user_id")]
        if member_ids:
            mres = service_supabase.table("profiles").select(
                "id, full_name, role, skills, experience_years, avatar_url"
            ).in_("id", member_ids).limit(100).execute()
            by_id = {p["id"]: p for p in (mres.data or [])}
            for r in rows:
                p = by_id.get(r.get("user_id")) or {}
                members.append({
                    "role": (r.get("permission") or p.get("role") or "").lower(),
                    "profile_role": (p.get("role") or "").lower(),
                    "name": p.get("full_name") or "",
                    "experience_years": p.get("experience_years"),
                    "skills": p.get("skills") or [],
                })
    except Exception:
        members = []

    data_rooms = _many("data_rooms", {"startup_id": startup_id})
    documents: list[dict] = []
    for dr in data_rooms:
        documents.extend(_many("data_room_documents", {"data_room_id": dr["id"]}))

    cap_table = _first("cap_tables", {"startup_id": startup_id})

    business_plan = None
    try:
        bp = (
            service_supabase.table("business_plans")
            .select("business_plan, pitch_deck, financial_projection, investor_readiness")
            .eq("user_id", startup.get("founder_id"))
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if bp.data:
            business_plan = bp.data[0]
    except Exception:
        business_plan = None

    applications = _many("applications", {"startup_id": startup_id})
    accepted = [a for a in applications if (a.get("status") or "").lower() == "accepted"]

    doc_categories = sorted({(d.get("category") or "").lower() for d in documents})

    return {
        "startup": startup,
        "founder": founder,
        "members": members,
        "data_rooms": data_rooms,
        "documents": documents,
        "doc_categories": doc_categories,
        "cap_table": cap_table,
        "business_plan": business_plan,
        "applications": applications,
        "accepted_applications": accepted,
    }


def coverage_report(sd: dict) -> dict:
    s = sd["startup"]
    present = []
    if (s.get("description") or "").strip():
        present.append("description")
    if (s.get("tagline") or "").strip():
        present.append("tagline")
    if (s.get("industry") or "").strip():
        present.append("industry")
    if s.get("stage"):
        present.append("stage")
    if s.get("tech_stack"):
        present.append("tech_stack")
    if s.get("team_roles_needed"):
        present.append("team_roles_needed")
    if sd.get("founder"):
        present.append("founder_profile")
    if sd.get("members"):
        present.append("team_members")
    if sd.get("applications"):
        present.append("applications")
    if sd.get("business_plan") and sd["business_plan"].get("business_plan"):
        present.append("business_plan")
    if sd.get("documents"):
        present.append("data_room")
    if sd.get("cap_table"):
        present.append("cap_table")
    if s.get("pitch_deck_url"):
        present.append("pitch_deck")
    missing = [f for f in COVERAGE_FIELDS if f not in present]
    return {
        "available": present,
        "missing": missing,
        "insufficient": len(present) < 4,
    }


def _pct(value: int, total: int) -> int:
    if total <= 0:
        return 0
    return max(0, min(100, round(value * 100 / total)))


# ---------------------------------------------------------------------------
# Deterministic scoring (pure data, no AI)
# ---------------------------------------------------------------------------

def score_health(sd: dict) -> dict:
    s = sd["startup"]
    desc_len = len((s.get("description") or "").strip())
    founder = sd.get("founder") or {}
    members = sd.get("members") or []
    apps = sd.get("applications") or []
    accepted = sd.get("accepted_applications") or []
    docs = sd.get("documents") or []
    cats = sd.get("doc_categories") or []
    bp = sd.get("business_plan") or {}
    cap = sd.get("cap_table")

    foundation = _pct(
        (60 if desc_len >= 300 else 40 if desc_len >= 100 else 20 if desc_len > 0 else 0)
        + (20 if (s.get("tagline") or "").strip() else 0)
        + (20 if (s.get("industry") or "").strip() else 0),
        100,
    )
    team = _pct(
        (25 if founder else 0)
        + (25 if (founder.get("experience_years") or 0) >= 3 else 10 if founder else 0)
        + (25 if len(members) >= 1 else 0)
        + (25 if len(members) >= 3 or s.get("team_roles_needed") else 0),
        100,
    )
    product = _pct(
        (40 if desc_len >= 300 else 25 if desc_len >= 100 else 10 if desc_len > 0 else 0)
        + (20 if s.get("tech_stack") else 0)
        + (20 if s.get("website_url") else 0)
        + (20 if s.get("pitch_deck_url") else 0),
        100,
    )
    traction = _pct(
        (40 if apps else 0)
        + (25 if accepted else 0)
        + (20 if s.get("is_verified") else 0)
        + (15 if bp.get("business_plan") else 0),
        100,
    )
    financials = _pct(
        (30 if s.get("funding_needed") else 0)
        + (20 if s.get("equity_offered") is not None else 0)
        + (30 if cap else 0)
        + (20 if bp.get("financial_projection") else 0),
        100,
    )
    data_room = _pct(
        min(40, 10 * len(docs))
        + (15 if "financial" in cats else 0)
        + (15 if "legal" in cats else 0)
        + (15 if "product" in cats else 0)
        + (15 if "pitch" in cats else 0),
        100,
    )

    categories = [
        {"key": "foundation", "label": "Foundation & Positioning", "score": foundation,
         "max": 100, "note": _health_note(foundation, "Clear description, tagline and industry positioning.")},
        {"key": "team", "label": "Team", "score": team,
         "max": 100, "note": _health_note(team, "Founder profile, team members and needed roles.")},
        {"key": "product", "label": "Product", "score": product,
         "max": 100, "note": _health_note(product, "Product detail, tech stack, website and pitch deck.")},
        {"key": "traction", "label": "Traction", "score": traction,
         "max": 100, "note": _health_note(traction, "Applications, accepted members, verification and business plan.")},
        {"key": "financials", "label": "Financials", "score": financials,
         "max": 100, "note": _health_note(financials, "Funding ask, equity offered, cap table and projections.")},
        {"key": "data_room", "label": "Data Room", "score": data_room,
         "max": 100, "note": _health_note(data_room, "Documents uploaded across financial, legal, product and pitch.")},
    ]

    weights = {"foundation": 20, "team": 20, "product": 20, "traction": 15,
               "financials": 12.5, "data_room": 12.5}
    overall = round(sum(c["score"] * weights[c["key"]] for c in categories) / 100)

    strengths = [
        {"title": c["label"], "detail": c["note"]}
        for c in categories if c["score"] >= 70
    ]
    weaknesses = [
        {"title": c["label"], "detail": c["note"], "impact": "Drags the overall health score down."}
        for c in categories if c["score"] < 50
    ]

    recommendations = []
    if not (s.get("description") or "").strip() or desc_len < 100:
        recommendations.append({"action": "Write a detailed startup description (100+ words covering problem, solution and market).", "priority": "high"})
    if not s.get("tagline"):
        recommendations.append({"action": "Add a one-line tagline that states what you do and for whom.", "priority": "medium"})
    if not s.get("industry"):
        recommendations.append({"action": "Pick your startup's industry so investors and talent can find you.", "priority": "high"})
    if not s.get("stage"):
        recommendations.append({"action": "Set your startup stage (idea, mvp, traction, growth, scale).", "priority": "medium"})
    if not s.get("tech_stack"):
        recommendations.append({"action": "List your tech stack so matching can find the right talent.", "priority": "medium"})
    if not s.get("team_roles_needed"):
        recommendations.append({"action": "Define the roles you need (team_roles_needed) to power the Team Gap Finder.", "priority": "high"})
    if not founder:
        recommendations.append({"action": "Complete your founder profile (bio, skills, experience) — investors evaluate the team first.", "priority": "high"})
    elif (founder.get("experience_years") or 0) < 3:
        recommendations.append({"action": "Detail your founder experience — domain and startup experience count toward team strength.", "priority": "medium"})
    if not members:
        recommendations.append({"action": "Invite team members to your startup on FounderHub.", "priority": "high"})
    if not apps:
        recommendations.append({"action": "Publish your startup and collect applications to build traction evidence.", "priority": "medium"})
    if not cap:
        recommendations.append({"action": "Set up your Cap Table to show financial structure to investors.", "priority": "medium"})
    if not docs:
        recommendations.append({"action": "Open your Data Room and upload at least financial, legal, product and pitch documents.", "priority": "high"})
    if not s.get("pitch_deck_url"):
        recommendations.append({"action": "Upload your pitch deck (link or Data Room document).", "priority": "medium"})

    return {
        "score": overall,
        "categories": categories,
        "strengths": strengths,
        "weaknesses": weaknesses,
        "recommendations": recommendations[:8],
    }


def _health_note(score: int, base: str) -> str:
    if score >= 70:
        return f"{base} This area looks solid."
    if score >= 40:
        return f"{base} Some gaps remain."
    return f"{base} Significant work needed here."


def score_team_gaps(sd: dict) -> dict:
    s = sd["startup"]
    founder = sd.get("founder") or {}
    members = sd.get("members") or []

    present_roles: set[str] = set()
    if founder and (founder.get("role") or "").lower():
        present_roles.add((founder.get("role") or "").lower())
    for m in members:
        role = (m.get("role") or m.get("profile_role") or "").lower()
        if role:
            present_roles.add(role)

    # Founder-only teams: the founder's startup role is "founder".
    present_list = [{"role": r, "member_count": 1 if r == (founder.get("role") or "").lower() else sum(1 for m in members if (m.get("role") or m.get("profile_role") or "").lower() == r)} for r in sorted(present_roles)]

    needed = [str(r).lower() for r in (s.get("team_roles_needed") or []) if str(r).lower() not in ("", "founder")]
    gaps = []

    # Deterministic gaps: roles explicitly needed but not present on the team.
    for role in needed:
        if role in present_roles:
            continue
        gaps.append(_build_gap(role, criticality="high", reason="Explicitly listed as a role this startup needs."))

    # If no explicit roles needed, flag obvious operational gaps from real signals.
    if not needed:
        if not present_roles or "marketer" not in present_roles:
            if (s.get("description") or "").strip() or s.get("industry"):
                gaps.append(_build_gap("marketer", criticality="medium",
                                       reason="No marketing role on the team; getting customers requires one."))
        if s.get("tech_stack") and "developer" not in present_roles:
            gaps.append(_build_gap("developer", criticality="medium",
                                   reason="A tech stack is defined but no developer is on the team yet."))
        if s.get("pitch_deck_url") or sd.get("cap_table") and "business_analyst" not in present_roles:
            gaps.append(_build_gap("business_analyst", criticality="low",
                                   reason="Fundraising materials exist; an analyst helps model the numbers."))

    # De-duplicate + sort by criticality.
    seen = set()
    unique = []
    for g in gaps:
        if g["role"] in seen:
            continue
        seen.add(g["role"])
        unique.append(g)
    priority_order = {"high": 0, "medium": 1, "low": 2}
    unique.sort(key=lambda g: priority_order.get(g.get("criticality", "low"), 3))

    return {
        "summary": (f"{s.get('name') or 'This startup'} has {len(present_list)} role{'s' if len(present_list) != 1 else ''} "
                    f"on the team and {len(unique)} gap{'s' if len(unique) != 1 else ''} to fill."),
        "present_roles": present_list,
        "gaps": unique,
    }


def _build_gap(role: str, criticality: str, reason: str) -> dict:
    knowledge = ROLE_KNOWLEDGE.get(role, {
        "label": role.replace("_", " ").title(),
        "skills": [],
        "responsibilities": [f"Own the {role.replace('_', ' ')} workstream"],
    })
    return {
        "role": role,
        "label": knowledge["label"],
        "criticality": criticality,
        "why": reason,
        "suggested_skills": knowledge["skills"],
        "responsibilities": knowledge["responsibilities"],
        "next_action": f"Find a matching {knowledge['label']} via AI Matching",
        "priority": 0 if criticality == "high" else 1 if criticality == "medium" else 2,
    }


def score_investor_readiness(sd: dict) -> dict:
    s = sd["startup"]
    desc_len = len((s.get("description") or "").strip())
    founder = sd.get("founder") or {}
    members = sd.get("members") or []
    apps = sd.get("applications") or []
    accepted = sd.get("accepted_applications") or []
    docs = sd.get("documents") or []
    cats = sd.get("doc_categories") or []
    bp = sd.get("business_plan") or {}
    cap = sd.get("cap_table")

    team = _pct(
        (25 if founder else 0)
        + (25 if (founder.get("experience_years") or 0) >= 3 else 10 if founder else 0)
        + (25 if members else 0)
        + (25 if len(members) >= 3 else 0),
        100,
    )
    product = _pct(
        (40 if desc_len >= 300 else 25 if desc_len >= 100 else 10 if desc_len > 0 else 0)
        + (20 if s.get("tech_stack") else 0)
        + (20 if s.get("website_url") else 0)
        + (20 if s.get("pitch_deck_url") else 0),
        100,
    )
    market = _pct(
        (30 if s.get("industry") else 0)
        + (25 if s.get("stage") else 0)
        + (25 if s.get("funding_needed") else 0)
        + (20 if s.get("is_verified") else 0),
        100,
    )
    traction = _pct(
        (40 if apps else 0)
        + (25 if accepted else 0)
        + (20 if s.get("is_verified") else 0)
        + (15 if bp.get("investor_readiness") else 0),
        100,
    )
    financials = _pct(
        (30 if s.get("funding_needed") else 0)
        + (20 if s.get("equity_offered") is not None else 0)
        + (30 if cap else 0)
        + (20 if bp.get("financial_projection") else 0),
        100,
    )
    data_room = _pct(
        min(40, 10 * len(docs))
        + (15 if "financial" in cats else 0)
        + (15 if "legal" in cats else 0)
        + (15 if "product" in cats else 0)
        + (15 if "pitch" in cats else 0),
        100,
    )
    pitch = _pct(
        (60 if s.get("pitch_deck_url") else 0)
        + (40 if bp.get("pitch_deck") else 0),
        100,
    )
    legal = _pct(
        (70 if "legal" in cats else 0)
        + (30 if bp.get("business_plan") else 0),
        100,
    )

    categories = [
        {"key": "team", "label": "Team", "score": team, "max": 100,
         "note": _health_note(team, "Founder and team depth — investors bet on the team first.")},
        {"key": "product", "label": "Product", "score": product, "max": 100,
         "note": _health_note(product, "How complete and credible the product story is.")},
        {"key": "market", "label": "Market", "score": market, "max": 100,
         "note": _health_note(market, "Industry, stage and funding ask clarity.")},
        {"key": "traction", "label": "Traction", "score": traction, "max": 100,
         "note": _health_note(traction, "Applications, verification and investor-readiness work.")},
        {"key": "financials", "label": "Financials", "score": financials, "max": 100,
         "note": _health_note(financials, "Cap table, funding ask and financial projections.")},
        {"key": "data_room", "label": "Data Room", "score": data_room, "max": 100,
         "note": _health_note(data_room, "Investor-facing documents uploaded.")},
        {"key": "pitch", "label": "Pitch", "score": pitch, "max": 100,
         "note": _health_note(pitch, "Pitch deck available for investor review.")},
        {"key": "legal", "label": "Legal", "score": legal, "max": 100,
         "note": _health_note(legal, "Legal documents and business plan on file.")},
    ]

    weights = {"team": 15, "product": 15, "market": 15, "traction": 20,
               "financials": 15, "data_room": 10, "pitch": 5, "legal": 5}
    overall = round(sum(c["score"] * weights[c["key"]] for c in categories) / 100)

    checklist = []
    if not members:
        checklist.append({"item": "Add team members so investors can see the full team.", "done": False, "category": "team"})
    if desc_len < 100:
        checklist.append({"item": "Write a 100+ word product description.", "done": False, "category": "product"})
    if not s.get("website_url"):
        checklist.append({"item": "Add a website or live product link.", "done": False, "category": "product"})
    if not s.get("funding_needed"):
        checklist.append({"item": "State your funding ask (funding_needed).", "done": False, "category": "market"})
    if not cap:
        checklist.append({"item": "Set up your Cap Table.", "done": False, "category": "financials"})
    if not bp.get("financial_projection"):
        checklist.append({"item": "Create financial projections (AI Business Plan generator).", "done": False, "category": "financials"})
    if not docs:
        checklist.append({"item": "Upload documents to your Data Room (financial, legal, product, pitch).", "done": False, "category": "data_room"})
    if "legal" not in cats:
        checklist.append({"item": "Add legal documents (incorporation, terms) to the Data Room.", "done": False, "category": "legal"})
    if not s.get("pitch_deck_url"):
        checklist.append({"item": "Upload your pitch deck.", "done": False, "category": "pitch"})
    if not bp.get("investor_readiness"):
        checklist.append({"item": "Run the AI Investor Readiness tool in your Business Plan workspace.", "done": False, "category": "traction"})

    return {
        "score": overall,
        "categories": categories,
        "strengths": [{"title": c["label"], "detail": c["note"]} for c in categories if c["score"] >= 70],
        "weaknesses": [{"title": c["label"], "detail": c["note"]} for c in categories if c["score"] < 50],
        "checklist": checklist,
        "summary": f"{s.get('name') or 'This startup'} scores {overall}/100 on investor readiness.",
    }


# ---------------------------------------------------------------------------
# AI enrichment (narrative only — never numbers)
# ---------------------------------------------------------------------------

def _summarize_startup(sd: dict) -> str:
    s = sd["startup"]
    lines = [
        f"Name: {s.get('name') or 'Untitled'}",
        f"Tagline: {s.get('tagline') or ''}",
        f"Industry: {s.get('industry') or 'not set'}",
        f"Stage: {s.get('stage') or 'not set'}",
        f"Funding needed: {s.get('funding_needed') or 'not set'}",
        f"Description: {(s.get('description') or '').strip()[:600]}",
        f"Tech stack: {', '.join(s.get('tech_stack') or []) or 'not set'}",
        f"Roles needed: {', '.join(s.get('team_roles_needed') or []) or 'not set'}",
        f"Location: {s.get('location') or 'not set'} (remote friendly: {bool(s.get('remote_friendly'))})",
    ]
    founder = sd.get("founder") or {}
    if founder:
        lines.append(f"Founder: {founder.get('full_name') or 'n/a'} | role={founder.get('role') or 'n/a'} "
                     f"| experience={founder.get('experience_years') or 0}y | skills={', '.join(founder.get('skills') or []) or 'n/a'}")
    members = sd.get("members") or []
    if members:
        lines.append(f"Team members: {len(members)} -> {', '.join(sorted({m.get('role') or m.get('profile_role') or '?' for m in members}))}")
    apps = sd.get("applications") or []
    if apps:
        lines.append(f"Applications received: {len(apps)} (accepted: {len(sd.get('accepted_applications') or [])})")
    docs = sd.get("documents") or []
    if docs:
        lines.append(f"Data room documents: {len(docs)} across categories: {', '.join(sd.get('doc_categories') or []) or 'n/a'}")
    if sd.get("cap_table"):
        lines.append(f"Cap table: set up ({sd['cap_table'].get('total_shares') or 'shares unknown'})")
    bp = sd.get("business_plan") or {}
    if bp.get("business_plan"):
        lines.append("Business plan: exists")
    if bp.get("financial_projection"):
        lines.append("Financial projection: exists")
    if s.get("pitch_deck_url"):
        lines.append("Pitch deck: linked")
    return "\n".join(lines)


async def _ai_narrative(kind: str, sd: dict, user_id: str, deterministic: dict) -> dict:
    """Best-effort AI enrichment. Returns extra narrative; {} if AI unavailable."""
    data = _summarize_startup(sd)
    if kind == "health":
        prompt = (
            "You are a startup analyst. Based ONLY on the following real data (do not invent metrics, "
            "revenue, users or numbers that are not listed), write a short 2-3 sentence summary of this "
            "startup's health and one-line notes for the given categories.\n\n"
            f"DATA:\n{data}\n\n"
            "Return STRICT JSON only:\n"
            '{"summary": "2-3 sentence health summary", "category_notes": {"foundation": "...", "team": "...", "product": "...", "traction": "...", "financials": "...", "data_room": "..."}}'
        )
    elif kind == "team_gaps":
        prompt = (
            "You are a startup team advisor. Based ONLY on the following real data, explain in 2-3 sentences "
            "why this team has the listed gaps and what to prioritize. Do not invent people or roles that "
            "are not real.\n\n"
            f"DATA:\n{data}\n\nDETERMINISTIC GAPS:\n{json.dumps(deterministic.get('gaps', []), default=str)[:1200]}\n\n"
            "Return STRICT JSON only:\n"
            '{"summary": "2-3 sentence gap analysis", "notes": {"role": "one-line advice"}}'
        )
    else:  # investor_readiness
        prompt = (
            "You are an investment-readiness advisor. Based ONLY on the following real data (do not invent "
            "metrics not listed), write a 2-3 sentence summary of this startup's investor readiness and "
            "one-line notes per category.\n\n"
            f"DATA:\n{data}\n\n"
            "Return STRICT JSON only:\n"
            '{"summary": "2-3 sentence investor-readiness summary", "category_notes": {"team": "...", "product": "...", "market": "...", "traction": "...", "financials": "...", "data_room": "...", "pitch": "...", "legal": "..."}}'
        )
    try:
        text = await asyncio.to_thread(generate_text_sync, user_id, prompt)
        parsed = json.loads(text)
        if not isinstance(parsed, dict):
            return {}
        return {k: v for k, v in parsed.items() if k in ("summary", "category_notes", "notes")}
    except Exception as exc:
        print(f"[startup_insights] AI narrative skipped ({kind}): {exc}")
        return {}


def _apply_narrative(result: dict, narrative: dict) -> dict:
    if narrative.get("summary"):
        result["summary"] = narrative["summary"]
    notes = narrative.get("category_notes") or narrative.get("notes") or {}
    if notes and result.get("categories"):
        for c in result["categories"]:
            if c["key"] in notes:
                c["note"] = f"{c['note']} {notes[c['key']]}".strip()
    return result


# ---------------------------------------------------------------------------
# Cache helpers
# ---------------------------------------------------------------------------

def _fetch_cached(table: str, startup_id: str) -> Optional[dict]:
    try:
        res = service_supabase.table(table).select("*").eq("startup_id", startup_id).limit(1).execute()
        return (res.data or [None])[0]
    except Exception:
        return None


def _save_analysis(table: str, row: dict) -> dict:
    try:
        res = service_supabase.table(table).upsert(row, on_conflict="startup_id").execute()
        return (res.data or [row])[0]
    except Exception as exc:
        print(f"[startup_insights] failed to save {table}: {exc}")
        return row


def _fresh(row: Optional[dict], refresh: bool) -> bool:
    if refresh or not row:
        return False
    from datetime import datetime, timezone
    try:
        created = row.get("created_at")
        if not created:
            return False
        age = (datetime.now(timezone.utc) - datetime.fromisoformat(created.replace("Z", "+00:00"))).total_seconds()
        return age < CACHE_TTL_SECONDS
    except Exception:
        return False
