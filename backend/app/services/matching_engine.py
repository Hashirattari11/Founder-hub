"""Explainable AI Matching Engine.

Weighted, transparent matching between a startup and users (talent or
investors). Every match produces:
- `score`: 0-100 weighted average
- `scores`: per-category {category, label, weight, score, max}
- `reasons`: human-readable "why" for each positive factor
- `concerns`: low-scoring factors the user should know about

Weights are configurable per request; defaults are documented and match the
product spec (skills/industry/experience/stage/goals/availability + role).
All inputs are REAL profile/startup rows — nothing is invented.
"""
from __future__ import annotations

from typing import Optional

from app.core.supabase import service_supabase

DEFAULT_WEIGHTS_TALENT = {
    "skills": 30,
    "role": 20,
    "industry": 15,
    "experience": 15,
    "stage": 10,
    "location": 5,
    "availability": 5,
}

DEFAULT_WEIGHTS_INVESTOR = {
    "industry": 30,
    "stage": 20,
    "funding": 20,
    "traction": 10,
    "team": 10,
    "location": 5,
    "goals": 5,
}

TALENT_ROLES = {"developer", "designer", "marketer", "mentor", "recruiter",
                "business_analyst", "legal_advisor", "founder"}

FUNDING_MIDPOINTS = {
    "Bootstrapped": 0,
    "Under $10K": 5,
    "$10K-$50K": 30,
    "$50K-$100K": 75,
    "$100K-$500K": 300,
    "$500K+": 750,
}


def _normalize_weights(weights: Optional[dict], default: dict) -> dict:
    if not weights:
        return dict(default)
    out = {}
    for k, v in default.items():
        out[k] = max(0, min(100, int(weights.get(k, v))))
    total = sum(out.values()) or 1
    return {k: round(v * 100 / total, 2) for k, v in out.items()}  # re-normalize to 100


def compute_match(startup: dict, target: dict, role: str,
                  weights: Optional[dict] = None) -> dict:
    """Score one user against one startup with full explainability."""
    role = (role or "").lower()
    is_investor = role == "investor" or (target.get("role") or "").lower() == "investor"

    if is_investor:
        return _match_investor(startup, target, weights)
    return _match_talent(startup, target, role or (target.get("role") or "talent"), weights)


def _match_talent(startup: dict, user: dict, role: str, weights: Optional[dict]) -> dict:
    w = _normalize_weights(weights, DEFAULT_WEIGHTS_TALENT)
    scores: list[dict] = []
    reasons: list[dict] = []
    concerns: list[dict] = []

    user_skills = {str(x).lower() for x in (user.get("skills") or [])}
    startup_tech = {str(x).lower() for x in (startup.get("tech_stack") or [])}
    startup_roles = {str(r).lower() for r in (startup.get("team_roles_needed") or [])}
    user_role = (user.get("role") or "").lower()

    # Skills
    overlap = user_skills.intersection(startup_tech)
    if startup_tech:
        ratio = len(overlap) / min(5, len(startup_tech))
        skills_score = max(45, round(ratio * 100)) if overlap else 20
    else:
        skills_score = 50
    if not startup_tech:
        skills_note = "Startup has not listed a tech stack — neutral score."
    elif overlap:
        skills_note = f"Matched {len(overlap)}/{min(5, len(startup_tech))} tech skill(s): {', '.join(sorted(overlap)[:5])}."
    else:
        skills_note = "No skill overlap with the startup's tech stack."
    scores.append({"category": "skills", "label": "Skills", "weight": w["skills"], "score": skills_score, "max": 100, "note": skills_note})

    # Role fit
    if user_role in startup_roles:
        role_score, role_note = 100, f"Your role ({user_role}) is exactly what this startup needs."
    elif role in startup_roles:
        role_score, role_note = 90, f"The {role} role is open and matches your profile."
    elif startup_roles:
        role_score, role_note = 40, f"The startup is looking for: {', '.join(sorted(startup_roles))}."
    else:
        role_score, role_note = 60, "Startup has not listed specific roles."
    scores.append({"category": "role", "label": "Role Fit", "weight": w["role"], "score": role_score, "max": 100, "note": role_note})

    # Industry fit
    industry = (startup.get("industry") or "").lower()
    hay = " ".join([str(user.get("bio") or "").lower(), str(user.get("company") or "").lower()] + sorted(user_skills))
    if industry and industry in hay:
        ind_score, ind_note = 85, f"Your background overlaps the {startup.get('industry')} industry."
    else:
        ind_score, ind_note = 55, "Industry overlap is unclear from your profile."
    scores.append({"category": "industry", "label": "Industry", "weight": w["industry"], "score": ind_score, "max": 100, "note": ind_note})

    # Experience
    exp = user.get("experience_years") or 0
    if exp >= 5:
        exp_score, exp_note = 100, f"{exp} years of experience."
    elif exp >= 3:
        exp_score, exp_note = 85, f"{exp} years of experience."
    elif exp >= 1:
        exp_score, exp_note = 65, f"{exp} year(s) of experience."
    else:
        exp_score, exp_note = 40, "Little documented experience yet."
    scores.append({"category": "experience", "label": "Experience", "weight": w["experience"], "score": exp_score, "max": 100, "note": exp_note})

    # Stage
    stage = (startup.get("stage") or "").lower()
    if stage in ("traction", "growth", "scale"):
        stage_score, stage_note = 80, f"Startup is at the {startup.get('stage')} stage — more momentum, more upside to join."
    elif stage in ("mvp",):
        stage_score, stage_note = 70, f"Startup is at {startup.get('stage')} stage — early but building."
    else:
        stage_score, stage_note = 55, f"Startup stage: {stage or 'not set'}."
    scores.append({"category": "stage", "label": "Stage", "weight": w["stage"], "score": stage_score, "max": 100, "note": stage_note})

    # Location
    if user.get("city") and user.get("city") == startup.get("location"):
        loc_score, loc_note = 100, f"You are in {user['city']} — same city as the startup."
    elif startup.get("remote_friendly"):
        loc_score, loc_note = 75, "Startup is remote-friendly."
    else:
        loc_score, loc_note = 45, "Location alignment is unclear."
    scores.append({"category": "location", "label": "Location", "weight": w["location"], "score": loc_score, "max": 100, "note": loc_note})

    # Availability
    if user.get("is_open_to_work") is False:
        avail_score, avail_note = 30, "You are marked as not open to new opportunities."
    else:
        avail_score, avail_note = 90, "You are open to new opportunities."
    scores.append({"category": "availability", "label": "Availability", "weight": w["availability"], "score": avail_score, "max": 100, "note": avail_note})

    return _assemble(scores, reasons, concerns, startup, user, role)


def _match_investor(startup: dict, investor: dict, weights: Optional[dict]) -> dict:
    w = _normalize_weights(weights, DEFAULT_WEIGHTS_INVESTOR)
    scores: list[dict] = []
    reasons: list[dict] = []
    concerns: list[dict] = []

    interests = [str(i).lower() for i in (investor.get("investor_interests") or [])]
    industry = (startup.get("industry") or "").lower()

    # Industry
    if industry and any(industry in i or i in industry for i in interests):
        ind_score, ind_note = 100, f"{startup.get('industry')} matches your investment interests."
    elif interests:
        ind_score, ind_note = 35, f"Startup sector ({startup.get('industry')}) is outside your stated interests."
    else:
        ind_score, ind_note = 50, "No investment interests listed yet."
    scores.append({"category": "industry", "label": "Industry", "weight": w["industry"], "score": ind_score, "max": 100, "note": ind_note})

    # Stage
    stage = (startup.get("stage") or "").lower()
    pref_stages = [str(x).lower() for x in (investor.get("investment_stage") or [])]
    if stage and stage in pref_stages:
        st_score, st_note = 100, f"Startup stage ({startup.get('stage')}) is in your preferred stages."
    elif pref_stages:
        st_score, st_note = 40, f"Preferred stages: {', '.join(pref_stages)}; startup is at {stage or 'not set'}."
    else:
        st_score, st_note = 60, "No stage preference listed."
    scores.append({"category": "stage", "label": "Stage", "weight": w["stage"], "score": st_score, "max": 100, "note": st_note})

    # Funding
    midpoint = FUNDING_MIDPOINTS.get(startup.get("funding_needed"), None)
    low = investor.get("investment_range_min") or 0
    high = investor.get("investment_range_max") or 1_000_000
    if midpoint is not None and low <= midpoint <= high:
        fund_score, fund_note = 100, f"Funding ask (~${midpoint}k) fits your range (${low}-${high}k)."
    elif midpoint is not None:
        fund_score, fund_note = 35, f"Funding ask (~${midpoint}k) is outside your range (${low}-${high}k)."
    else:
        fund_score, fund_note = 55, "Startup has not set a funding ask."
    scores.append({"category": "funding", "label": "Funding Fit", "weight": w["funding"], "score": fund_score, "max": 100, "note": fund_note})

    # Traction (real signals)
    apps = 0
    try:
        res = service_supabase.table("applications").select("id").eq("startup_id", startup["id"]).execute()
        apps = len(res.data or [])
    except Exception:
        apps = 0
    if apps >= 5:
        tr_score, tr_note = 90, f"{apps} applications received — real demand signal."
    elif apps >= 1:
        tr_score, tr_note = 65, f"{apps} application(s) received."
    else:
        tr_score, tr_note = 40, "No applications received yet."
    scores.append({"category": "traction", "label": "Traction", "weight": w["traction"], "score": tr_score, "max": 100, "note": tr_note})

    # Team
    founder = None
    try:
        fres = service_supabase.table("profiles").select("id, experience_years, full_name").eq("id", startup.get("founder_id")).limit(1).execute()
        founder = (fres.data or [None])[0]
    except Exception:
        founder = None
    try:
        mres = service_supabase.table("startup_members").select("user_id").eq("startup_id", startup["id"]).execute()
        member_count = len(mres.data or [])
    except Exception:
        member_count = 0
    if founder and (founder.get("experience_years") or 0) >= 3:
        team_score, team_note = 80, f"Founder has {founder.get('experience_years')} years of experience."
    elif founder:
        team_score, team_note = 60, "Founder profile exists but limited documented experience."
    else:
        team_score, team_note = 35, "No founder profile on record."
    if member_count:
        team_note += f" {member_count} team member(s) added."
    scores.append({"category": "team", "label": "Team", "weight": w["team"], "score": team_score, "max": 100, "note": team_note})

    # Location
    if investor.get("city") and investor.get("city") == startup.get("location"):
        loc_score, loc_note = 100, f"You are in {investor['city']} — same city as the startup."
    else:
        loc_score, loc_note = 60, "No location conflict."
    scores.append({"category": "location", "label": "Location", "weight": w["location"], "score": loc_score, "max": 100, "note": loc_note})

    # Goals
    goals_score, goals_note = (100, "Startup is published and seeking funding.") if startup.get("is_published") else (45, "Startup is not yet published.")
    scores.append({"category": "goals", "label": "Deal Fit", "weight": w["goals"], "score": goals_score, "max": 100, "note": goals_note})

    return _assemble(scores, reasons, concerns, startup, investor, "investor")


def _assemble(scores: list[dict], reasons: list[dict], concerns: list[dict],
              startup: dict, user: dict, role: str) -> dict:
    total_weight = sum(s["weight"] for s in scores) or 1
    contributions = []
    for s in scores:
        contrib = round(s["weight"] * s["score"] / 100, 1)
        contributions.append((s, contrib))
        if s["score"] >= 70 and s["weight"] > 0:
            reasons.append({
                "factor": s["label"],
                "detail": s["note"],
                "weight": s["weight"],
                "contribution": contrib,
            })
        elif s["score"] < 50 and s["weight"] > 0:
            concerns.append({
                "factor": s["label"],
                "detail": s["note"],
            })
    overall = round(sum(c for _, c in contributions) * 100 / total_weight) if total_weight else 0
    overall = max(0, min(100, overall))
    reasons.sort(key=lambda r: r["contribution"], reverse=True)
    return {
        "score": overall,
        "scores": scores,
        "reasons": reasons,
        "concerns": concerns,
    }


def get_target_users(roles: list[str], limit: int = 200) -> list[dict]:
    """Real profiles whose primary role is in `roles`."""
    if not roles:
        return []
    try:
        res = service_supabase.table("profiles").select("*").in_("role", roles).limit(limit).execute()
        return res.data or []
    except Exception:
        return []


def run_matching(startup: dict, roles: list[str],
                 weights: Optional[dict] = None,
                 min_score: int = 50,
                 created_by: Optional[str] = None) -> list[dict]:
    """Compute + persist matches for the given roles. Returns stored rows."""
    stored: list[dict] = []
    targets = get_target_users(roles)
    for target in targets:
        role = (target.get("role") or "").lower()
        if role == "administrator" or not role:
            continue
        result = compute_match(startup, target, role, weights)
        if result["score"] < min_score:
            continue
        row = {
            "startup_id": startup["id"],
            "target_user_id": target["id"],
            "role": role,
            "score": result["score"],
            "scores": result["scores"],
            "reasons": result["reasons"],
            "concerns": result["concerns"],
            "created_by": created_by,
        }
        try:
            res = service_supabase.table("ai_matches").upsert(row, on_conflict="startup_id,target_user_id,role").execute()
            stored.append((res.data or [row])[0])
        except Exception as exc:
            print(f"[matching_engine] failed to store match for {target['id']}: {exc}")
    stored.sort(key=lambda r: r.get("score") or 0, reverse=True)
    return stored
