"""AI Business Plan Generator — deterministic offline engine + AI enhancement.

The generator always produces a complete, structured business plan (30 sections,
pitch deck, financial projection, team recommendations, investor readiness and
AI recommendations) purely from the founder's inputs. When the user has a
preferred AI source configured, the offline draft is sent to the model for a
richer rewrite of the narrative blocks; any AI output is merged per-section so
the result is always valid and complete.
"""
from __future__ import annotations

import json
import re
import secrets
from typing import Optional

from app.api.ai import generate_text_sync

STAGES = {"idea", "mvp", "traction", "growth", "scale"}
MODELS = {"saas", "marketplace", "ecommerce", "subscription", "ads", "agency", "hardware", "consulting", "fintech", "other"}

STAGE_LABELS = {
    "idea": "Idea stage",
    "mvp": "MVP / early product",
    "traction": "Early traction",
    "growth": "Growth",
    "scale": "Scale-up",
}

MODEL_LABELS = {
    "saas": "SaaS (software-as-a-service)",
    "marketplace": "Two-sided marketplace",
    "ecommerce": "E-commerce / direct-to-consumer",
    "subscription": "Subscription model",
    "ads": "Advertising / freemium",
    "agency": "Agency / services",
    "hardware": "Hardware / physical product",
    "consulting": "Consulting / professional services",
    "fintech": "Fintech / payments / lending",
    "other": "Custom / hybrid",
}

INDUSTRY_FACTORS = {
    "ai": 1.6, "software": 1.5, "saas": 1.5, "fintech": 1.5, "health": 1.2,
    "healthcare": 1.2, "education": 1.1, "ecommerce": 1.3, "retail": 1.1,
    "food": 1.0, "travel": 1.1, "real estate": 1.1, "climate": 1.2,
    "energy": 1.2, "logistics": 1.1, "cybersecurity": 1.4, "gaming": 1.3,
    "media": 1.2, "manufacturing": 1.0,
}

SECTION_KEYS = [
    ("executive_summary", "Executive Summary"),
    ("company_overview", "Company Overview"),
    ("mission_vision", "Mission & Vision"),
    ("problem", "Problem Statement"),
    ("market_opportunity", "Market Opportunity"),
    ("solution", "Solution & Product Description"),
    ("product_features", "Product Features & Roadmap"),
    ("value_proposition", "Unique Value Proposition"),
    ("business_model", "Business Model"),
    ("revenue_streams", "Revenue Streams"),
    ("pricing", "Pricing Strategy"),
    ("cost_structure", "Cost Structure"),
    ("customer_segments", "Target Market & Customer Segments"),
    ("target_audience", "Target Audience Profile"),
    ("competition", "Competitor Analysis"),
    ("competitive_advantage", "Competitive Advantage"),
    ("marketing_strategy", "Marketing Strategy"),
    ("sales_strategy", "Sales Strategy"),
    ("go_to_market", "Go-to-Market Plan"),
    ("acquisition_retention", "Customer Acquisition & Retention"),
    ("operations", "Operations Plan"),
    ("technology", "Technology & Infrastructure"),
    ("legal_compliance", "Legal & Regulatory Compliance"),
    ("team_org", "Team & Organization Structure"),
    ("hiring_plan", "Hiring Plan"),
    ("financial_summary", "Financial Projections Summary"),
    ("funding_requirements", "Funding Requirements & Use of Funds"),
    ("milestones", "Milestones & Timeline"),
    ("risks", "Risks & Mitigations"),
    ("exit_strategy", "Exit Strategy"),
]

PITCH_DECK_KEYS = [
    ("title", "Title"),
    ("problem", "Problem"),
    ("solution", "Solution"),
    ("market", "Market Opportunity"),
    ("product", "Product"),
    ("traction", "Traction"),
    ("business_model", "Business Model"),
    ("financials", "Financials"),
    ("team", "Team"),
    ("competition", "Competition"),
    ("roadmap", "Roadmap"),
    ("ask", "The Ask"),
]


class PlanInputs:
    """Normalized, validated generator inputs."""

    def __init__(self, startup_name: str, idea: str, **kw):
        self.startup_name = (startup_name or "My Startup").strip()
        self.idea = (idea or "").strip()
        self.industry = str(kw.get("industry") or "").strip()
        self.country = str(kw.get("country") or "Global").strip()
        self.target_audience = str(kw.get("target_audience") or "").strip()
        self.stage = kw.get("stage") if kw.get("stage") in STAGES else "idea"
        self.funding_goal = max(0, int(kw.get("funding_goal") or 0))
        self.budget = max(0, int(kw.get("budget") or 0))
        self.team_size = max(1, int(kw.get("team_size") or 1))
        model = kw.get("business_model") or "other"
        self.business_model = model if model in MODELS else "other"

    @property
    def industry_factor(self) -> float:
        key = self.industry.lower().strip()
        if not key:
            return 1.0
        for k, v in INDUSTRY_FACTORS.items():
            if k in key:
                return v
        return 1.0

    def to_dict(self) -> dict:
        return {
            "startup_name": self.startup_name,
            "idea": self.idea,
            "industry": self.industry,
            "country": self.country,
            "target_audience": self.target_audience,
            "stage": self.stage,
            "funding_goal": self.funding_goal,
            "budget": self.budget,
            "team_size": self.team_size,
            "business_model": self.business_model,
        }


# ---------------------------------------------------------------------------
# Financial model (deterministic, 12-month forecast)
# ---------------------------------------------------------------------------

def _compute_financials(inp: PlanInputs) -> dict:
    funding = inp.funding_goal
    budget = inp.budget
    team = inp.team_size
    if budget <= 0:
        budget = max(1200, team * 3200)

    salaries = team * 3500
    marketing = int(budget * 0.18)
    infra = int(budget * 0.12)
    ops = int(budget * 0.10)
    other = max(0, budget - salaries - marketing - infra - ops)
    expense_breakdown = {
        "salaries": salaries,
        "marketing": marketing,
        "infrastructure_tools": infra,
        "operations": ops,
        "other": other,
        "total": budget,
    }

    factor = inp.industry_factor
    base_rev = max(300, int(team * 650 * factor))

    months = 12
    revenue: list[int] = []
    growth_pct: list[float] = []
    rev = base_rev
    for i in range(months):
        if i > 0:
            g = max(0.04, 0.16 - 0.010 * i)
            rev = rev * (1 + g)
        revenue.append(int(round(rev)))
        growth_pct.append(round(max(0.04, 0.16 - 0.010 * i) * 100, 1))

    expenses = [budget] * months
    cash_flow = [revenue[i] - expenses[i] for i in range(months)]
    cumulative: list[int] = []
    acc = funding
    for cf in cash_flow:
        acc += cf
        cumulative.append(acc)

    break_even_month: Optional[int] = None
    for i in range(months):
        if revenue[i] >= expenses[i]:
            break_even_month = i + 1
            break

    negative = [cf for cf in cash_flow[:6] if cf < 0]
    avg_burn = abs(int(sum(negative) / len(negative))) if negative else 0
    runway_months = int(funding / avg_burn) if avg_burn > 0 else None

    return {
        "monthly_revenue": revenue,
        "monthly_expenses": expenses,
        "monthly_cash_flow": cash_flow,
        "cumulative_cash": cumulative,
        "growth_pct": growth_pct,
        "expense_breakdown": expense_breakdown,
        "monthly_budget": budget,
        "break_even_month": break_even_month,
        "runway_months": runway_months,
        "burn_rate": avg_burn,
        "funding_requirement": funding,
        "use_of_funds": _use_of_funds(inp.stage, funding),
        "year1_revenue": sum(revenue),
        "year2_revenue": int(revenue[-1] * 12 * 1.9),
        "year3_revenue": int(revenue[-1] * 12 * 3.4),
        "key_assumptions": [
            f"Monthly operating budget of ${budget:,} sustained through the forecast period.",
            f"Revenue starts at ${base_rev:,}/month and ramps {growth_pct[0]}% month-over-month as the product gains traction.",
            f"Salaries (${salaries:,} for a {team}-person team) are the largest fixed cost.",
            "Customer churn and seasonality are not modeled in detail; figures are planning estimates, not guarantees.",
        ],
    }


def _use_of_funds(stage: str, funding: int) -> list[dict]:
    ratios = {
        "idea": {"product_development": 0.50, "hiring": 0.20, "marketing": 0.20, "operations": 0.10},
        "mvp": {"product_development": 0.42, "hiring": 0.28, "marketing": 0.20, "operations": 0.10},
        "traction": {"product_development": 0.34, "hiring": 0.32, "marketing": 0.24, "operations": 0.10},
        "growth": {"product_development": 0.30, "hiring": 0.34, "marketing": 0.26, "operations": 0.10},
        "scale": {"product_development": 0.26, "hiring": 0.36, "marketing": 0.28, "operations": 0.10},
    }
    r = ratios.get(stage, ratios["idea"])
    return [
        {"label": "Product development", "percent": int(r["product_development"] * 100), "amount": int(funding * r["product_development"])},
        {"label": "Hiring & team", "percent": int(r["hiring"] * 100), "amount": int(funding * r["hiring"])},
        {"label": "Marketing & growth", "percent": int(r["marketing"] * 100), "amount": int(funding * r["marketing"])},
        {"label": "Operations", "percent": int(r["operations"] * 100), "amount": int(funding * r["operations"])},
    ]


def _money(n) -> str:
    return f"${int(n or 0):,}"


# ---------------------------------------------------------------------------
# Team recommendations (8 roles)
# ---------------------------------------------------------------------------

def _team_recommendations(inp: PlanInputs) -> list[dict]:
    headcount = {"idea": 2, "mvp": 3, "traction": 4, "growth": 6, "scale": 8}
    roles = [
        {"role": "Chief Executive Officer", "seniority": "Founder / CEO", "count": 1, "remote_ok": False,
         "reason": "Owns the vision, fundraising, partnerships and overall direction of the company."},
        {"role": "Chief Technology Officer", "seniority": "Senior / Principal", "count": 1, "remote_ok": True,
         "reason": "Leads product architecture and engineering; critical if the idea has meaningful technical risk."},
        {"role": "Product Manager", "seniority": "Mid / Senior", "count": 1, "remote_ok": True,
         "reason": "Turns the roadmap into shipped features by coordinating engineering, design and customers."},
        {"role": "Product Designer", "seniority": "Mid", "count": 1, "remote_ok": True,
         "reason": "Owns UX/UI and brand so the product feels polished from the first impression."},
        {"role": "Marketing / Growth Lead", "seniority": "Mid / Senior", "count": 1, "remote_ok": True,
         "reason": "Runs acquisition channels and positioning; the difference between a product and a business."},
        {"role": "Sales / Business Development", "seniority": "Mid", "count": 1, "remote_ok": True,
         "reason": "Converts pipeline into revenue and opens strategic partnerships for distribution."},
        {"role": "Software Engineer(s)", "seniority": "Mid", "count": max(1, headcount.get(inp.stage, 2) - 4), "remote_ok": True,
         "reason": "Builds and maintains the product; headcount scales with engineering complexity."},
        {"role": "Finance / Operations Manager", "seniority": "Mid", "count": 1, "remote_ok": True,
         "reason": "Owns budgeting, burn management, legal, accounting and day-to-day operations."},
    ]
    if inp.team_size >= 8:
        roles[6]["count"] += 1
    return roles


# ---------------------------------------------------------------------------
# Investor readiness
# ---------------------------------------------------------------------------

def _readiness(inp: PlanInputs, fin: dict) -> dict:
    stage_points = {"idea": 32, "mvp": 50, "traction": 68, "growth": 84, "scale": 94}
    product = min(96, stage_points[inp.stage] + (8 if inp.business_model != "other" else 0))
    market = min(96, 52 + int(inp.industry_factor * 16) + (6 if inp.target_audience else 0))
    team = min(96, 38 + inp.team_size * 6)
    financial = 46 + (12 if inp.funding_goal > 0 else 0) + (8 if inp.budget > 0 else 0)
    if fin.get("break_even_month"):
        financial += 18
    financial = min(96, financial)

    overall = round(0.30 * product + 0.25 * market + 0.20 * team + 0.25 * financial)

    if overall >= 80:
        label = "Investor-ready"
        summary = (f"{inp.startup_name} presents a compelling, investor-ready package. The team and market are strong, "
                   "financial planning is grounded, and the business is positioned to raise on favourable terms.")
    elif overall >= 65:
        label = "Fundable"
        summary = (f"{inp.startup_name} is a solid early-stage opportunity. Strengthening traction and a few operational "
                   "details will materially improve the chances of closing a round.")
    elif overall >= 45:
        label = "Building"
        summary = (f"{inp.startup_name} is at an early stage with clear potential. Investors will want to see product-market "
                   "fit signals, a sharper go-to-market plan and tighter unit economics before committing.")
    else:
        label = "Early stage"
        summary = (f"{inp.startup_name} is at the very beginning of its journey. Focus on validating the core problem, "
                   "building a minimum viable product and gathering early user feedback before approaching investors.")

    return {
        "scores": [
            {"label": "Product & Traction", "score": product, "max": 100},
            {"label": "Market Opportunity", "score": market, "max": 100},
            {"label": "Team & Execution", "score": team, "max": 100},
            {"label": "Financial Planning", "score": financial, "max": 100},
        ],
        "overall": overall,
        "label": label,
        "summary": summary,
    }


# ---------------------------------------------------------------------------
# AI recommendations (6 categories)
# ---------------------------------------------------------------------------

def _ai_recommendations(inp: PlanInputs, fin: dict) -> dict:
    name = inp.startup_name
    missing_features = [
        f"Define a minimum lovable feature set for the first release of {name} — ship one outcome well before adding breadth.",
        "Add a public, honest product roadmap with timelines so early users and investors can follow progress.",
        "Instrument product analytics from day one (activation, retention, referral) to prove traction with data.",
        "Create a documented onboarding flow that turns first-time visitors into activated users within 10 minutes.",
    ]
    if inp.business_model == "saas":
        missing_features.append("Build self-serve sign-up and a 14-day trial to reduce sales friction.")
    elif inp.business_model == "marketplace":
        missing_features.append("Design a supply-side acquisition loop, since marketplaces live or die on liquidity.")

    weaknesses = [
        f"Early-stage execution risk: {name} must show repeatable traction before the market will believe the forecast.",
        f"The current team of {inp.team_size} is lean; key roles need to be hired before scaling marketing spend.",
        f"Burning {_money(fin.get('burn_rate'))}/month means runway discipline will decide the company's fate.",
    ]
    if inp.industry:
        weaknesses.append(f"Competition in the {inp.industry} space is intense — differentiation must be proven, not assumed.")

    improvements = [
        "Run customer discovery interviews with at least 20 target users before scaling spend.",
        "Publish monthly metrics (revenue, retention, CAC, payback period) to build investor confidence.",
        "Secure 3–5 design-partner customers who will pay early and give public testimonials.",
        "Revisit pricing after the first 50 paying customers to optimize the price points and packaging.",
    ]
    if inp.stage in ("growth", "scale"):
        improvements.append("Invest in a proper data warehouse and reporting stack before the data gets messy.")

    risks = [
        "Customer acquisition cost exceeding lifetime value — monitor payback period every week.",
        "Key-person risk: if a founder or lead engineer leaves, execution slows dramatically.",
        "Regulatory or compliance exposure depending on industry and target geography.",
        "Competitive response from larger incumbents with more capital and distribution.",
    ]

    scaling_plan = [
        f"Phase 1 (months 1–3): validate the core problem with {name} in {inp.country} and refine the MVP.",
        "Phase 2 (months 4–6): achieve repeatable acquisition through 2 focused channels and hit payback < 6 months.",
        "Phase 3 (months 7–12): expand the team, open the next market or segment, and reach operational break-even.",
        "Phase 4 (year 2+): broaden the product surface, deepen enterprise/partner motion and prepare for a larger round.",
    ]

    internationalization = [
        f"Default to English-first product copy so {name} can expand beyond {inp.country} without a rewrite.",
        "Choose payment and compliance infrastructure that supports multiple currencies from the start.",
        "Plan for local pricing adjustments after observing the first 6 months of conversion data.",
        "Prioritize expansion into 1–2 adjacent markets only after home-market traction is proven.",
    ]

    return {
        "missing_features": missing_features,
        "weaknesses": weaknesses,
        "improvements": improvements,
        "risks": risks,
        "scaling_plan": scaling_plan,
        "internationalization": internationalization,
    }


# ---------------------------------------------------------------------------
# 30 business plan sections (offline templates)
# ---------------------------------------------------------------------------

def _audience(inp: PlanInputs) -> str:
    return inp.target_audience or f"early adopters in the {inp.industry or 'target'} space"


def _build_sections(inp: PlanInputs, fin: dict) -> list[dict]:
    name = inp.startup_name
    idea = inp.idea or f"an early-stage venture focused on the {inp.industry or 'target'} opportunity"
    aud = _audience(inp)
    stage = STAGE_LABELS[inp.stage].lower()
    model = MODEL_LABELS[inp.business_model]
    country = inp.country
    ind = inp.industry or "target"
    breakeven = f"month {fin['break_even_month']}" if fin.get("break_even_month") else "beyond the 12-month window"
    runway = f"{fin['runway_months']} months" if fin.get("runway_months") else "to be determined as burn normalizes"

    s: dict[str, str] = {}

    s["executive_summary"] = (
        f"{name} is a {stage} startup in the {ind} space building a solution around the following idea: {idea}\n\n"
        f"Targeting {aud} primarily in {country}, {name} operates on a {model} model with a current team of "
        f"{inp.team_size} people. The company is planning to raise {_money(inp.funding_goal)} to fund product "
        f"development, hiring and growth.\n\n"
        f"- Revenue is forecast to reach {_money(fin['year1_revenue'])} in year one, growing to "
        f"{_money(fin['year3_revenue'])} by year three.\n"
        f"- Operational break-even is projected around {breakeven}.\n"
        f"- Estimated runway of {runway} on the current plan.\n\n"
        f"Founders should treat these figures as planning estimates and validate them against real customer data "
        f"as the business launches."
    )

    s["company_overview"] = (
        f"{name} is a {stage} company founded to solve a concrete problem for {aud}. The company is registered to "
        f"operate in {country} and structured around a lean, outcome-focused culture.\n\n"
        f"- Industry focus: {ind}\n"
        f"- Business model: {model}\n"
        f"- Current stage: {stage.capitalize()}\n"
        f"- Team size: {inp.team_size}\n\n"
        f"At this stage the organization is small and nimble, which allows rapid iteration while validating the "
        f"core business hypothesis."
    )

    s["mission_vision"] = (
        f"Mission: To make a meaningful difference for {aud} by delivering a {ind} solution that is simpler, faster "
        f"and more accessible than what exists today.\n\n"
        f"Vision: A world where {aud} can solve their most pressing problems with {name} — becoming the default "
        f"choice in the {ind} category within five years."
    )

    s["problem"] = (
        f"The core problem {name} addresses is a real, painful gap for {aud} in the {ind} space.\n\n"
        f"- Existing solutions are fragmented, expensive, or require too much effort.\n"
        f"- {aud.capitalize()} currently waste time and money on workarounds because nothing fits their needs well.\n"
        f"- Incumbents are slow to innovate and rarely built for the modern user.\n\n"
        f"{name} starts from the specific friction points observed with real users rather than assuming a need — "
        f"each hypothesis is being validated through discovery conversations."
    )

    s["market_opportunity"] = (
        f"The market for {ind} solutions is large and growing. {name} targets {aud}, which represents a "
        f"substantial addressable segment in {country} and globally.\n\n"
        f"- TAM: the total global spend in the {ind} category.\n"
        f"- SAM: the serviceable portion that {name}'s {model} model can realistically reach.\n"
        f"- SOM: the near-term share {name} can capture within the first 2–3 years with focused distribution.\n\n"
        f"With {_money(fin['year3_revenue'])} of projected year-three revenue, even a small share of the "
        f"category represents a meaningful business."
    )

    s["solution"] = (
        f"{name} addresses the problem with a focused, {model}-based solution built around the idea: {idea}\n\n"
        f"- Designed specifically for {aud}.\n"
        f"- Prioritizes the workflows that matter most, removing steps that add friction.\n"
        f"- Ships incrementally so user feedback shapes every release.\n\n"
        f"The product is being developed with the principle that a simple solution to the core problem beats a "
        f"complex solution to many problems."
    )

    s["product_features"] = (
        f"The near-term product roadmap for {name} focuses on a minimum lovable feature set.\n\n"
        f"- Phase 1 (validate): core workflow that proves the value proposition for {aud}.\n"
        f"- Phase 2 (adopt): onboarding, activation and retention loops.\n"
        f"- Phase 3 (scale): integrations, automation and self-serve expansion.\n\n"
        f"Features are prioritized against a simple test: does it help {aud} solve the core problem faster or "
        f"cheaper?"
    )

    s["value_proposition"] = (
        f"{name} is uniquely positioned for {aud} because it combines a deep focus on the {ind} use case with "
        f"modern product quality.\n\n"
        f"- Simpler to adopt than generic alternatives.\n"
        f"- Built specifically for the workflows of {aud}.\n"
        f"- Priced and packaged to make the decision easy.\n\n"
        f"The value proposition will be tightened further as early customer interviews confirm which benefits "
        f"resonate most."
    )

    s["business_model"] = (
        f"{name} operates on a {model} model.\n\n"
        f"- Revenue is generated from the product and pricing described in this plan.\n"
        f"- Costs are concentrated in salaries, infrastructure, marketing and operations.\n"
        f"- Unit economics will be tracked rigorously from the first paying customer.\n\n"
        f"The model is chosen because it aligns incentives: {name} grows when customers receive genuine value."
    )

    s["revenue_streams"] = (
        f"{name} plans to build revenue through one or more of the following streams, anchored by the "
        f"{model} model.\n\n"
        f"- Core product revenue from the primary offering.\n"
        f"- Expansion revenue from upgrades, add-ons or higher tiers as customers grow.\n"
        f"- (Optional) ancillary streams such as partnerships or professional services.\n\n"
        f"Revenue streams are intentionally focused at first — a single strong stream beats three weak ones."
    )

    s["pricing"] = (
        f"Pricing for {name} is designed to be simple and value-aligned.\n\n"
        f"- Anchor pricing to the value {aud} receives rather than cost-plus.\n"
        f"- Offer a clear free or low-cost entry point to lower adoption friction.\n"
        f"- Revisit pricing after the first ~50 paying customers using real conversion data.\n\n"
        f"The exact price points will be validated through pricing tests during the first growth phase."
    )

    s["cost_structure"] = (
        f"The primary cost drivers for {name} are:\n\n"
        f"- Salaries: {_money(fin['expense_breakdown']['salaries'])}/month for a {inp.team_size}-person team.\n"
        f"- Marketing: {_money(fin['expense_breakdown']['marketing'])}/month.\n"
        f"- Infrastructure & tools: {_money(fin['expense_breakdown']['infrastructure_tools'])}/month.\n"
        f"- Operations: {_money(fin['expense_breakdown']['operations'])}/month.\n\n"
        f"Total monthly burn is projected at {_money(fin['monthly_budget'])}. Cost discipline is a core company "
        f"value, especially in the early stage."
    )

    s["customer_segments"] = (
        f"{name} serves distinct customer segments that share a common problem:\n\n"
        f"- Primary: {aud}.\n"
        f"- Secondary: adjacent users in the {ind} space who face similar pain.\n"
        f"- (Later) enterprise or partner channels once product-market fit is proven.\n\n"
        f"Each segment is described with clear criteria so sales and marketing can focus spend on the users most "
        f"likely to adopt early."
    )

    s["target_audience"] = (
        f"The target audience for {name} is {aud}. \n\n"
        f"- Located primarily in {country}.\n"
        f"- Active in the {ind} space with a genuine, recurring need.\n"
        f"- Receptive to a modern, simpler alternative.\n\n"
        f"Personas are refined from discovery interviews and early usage data, keeping the definition tight enough "
        f"to win one segment before expanding."
    )

    s["competition"] = (
        f"The {ind} landscape includes established players, point solutions and new entrants. {name} differentiates "
        f"by focusing on {aud} rather than trying to serve everyone.\n\n"
        f"- Direct competitors: products that solve a similar problem.\n"
        f"- Indirect competitors: manual workarounds and adjacent tools.\n"
        f"- Substitute behavior: doing nothing or using a generic solution.\n\n"
        f"The plan is to win the segment competitors underserve, then expand outward."
    )

    s["competitive_advantage"] = (
        f"{name}'s durable advantages include:\n\n"
        f"- Deep focus on the {ind} use case and {aud}.\n"
        f"- Speed of iteration enabled by a lean, senior team.\n"
        f"- Distribution advantages from the go-to-market plan described below.\n\n"
        f"Advantages that are purely cosmetic are treated as risks, not moats, until proven in the market."
    )

    s["marketing_strategy"] = (
        f"The marketing strategy for {name} is channel-focused and measurable.\n\n"
        f"- Content and SEO targeting {ind} search intent.\n"
        f"- Community and partnerships inside the {ind} ecosystem.\n"
        f"- Paid acquisition only after organic channels prove unit economics.\n\n"
        f"Every campaign is tied to a target cost-per-acquisition so spend scales with confidence."
    )

    s["sales_strategy"] = (
        f"Sales at {name} follows the model: self-serve first, assisted where it pays.\n\n"
        f"- Frictionless sign-up and activation for the majority of customers.\n"
        f"- Outbound and partner-driven sales for larger accounts.\n"
        f"- A feedback loop from sales calls straight into the product roadmap.\n\n"
        f"The sales motion is kept repeatable and documented so new hires ramp quickly."
    )

    s["go_to_market"] = (
        f"{name}'s go-to-market plan starts narrow and expands deliberately.\n\n"
        f"- Launch: focus on {aud} in {country} with a clear, single message.\n"
        f"- Validate: measure activation and retention to confirm the pitch.\n"
        f"- Scale: expand channels, then adjacent segments and markets.\n\n"
        f"Timing for each step is tied to the milestones in this plan rather than calendar pressure."
    )

    s["acquisition_retention"] = (
        f"Acquisition and retention are managed as a single system at {name}.\n\n"
        f"- Acquisition: two focused channels initially, measured by CAC and payback period.\n"
        f"- Activation: first-value experience within the first session.\n"
        f"- Retention: onboarding, notifications and a clear success path.\n\n"
        f"The goal is a repeatable loop: acquire → activate → retain → expand → refer."
    )

    s["operations"] = (
        f"Operations at {name} are lean by design.\n\n"
        f"- Tools: a small, modern stack shared across the team.\n"
        f"- Process: lightweight rituals for planning, review and customer feedback.\n"
        f"- Outsourcing: legal, accounting and payroll handled by trusted partners.\n\n"
        f"Operational capacity is added only when revenue or team size justifies it."
    )

    s["technology"] = (
        f"Technology is a core enabler of {name}.\n\n"
        f"- Architecture: a modular stack that supports the {model} model.\n"
        f"- Infrastructure: cloud-native with cost monitoring from day one.\n"
        f"- Security: encryption, access control and regular reviews baked into the roadmap.\n\n"
        f"Technical debt is tracked and paid down deliberately so the product stays fast to evolve."
    )

    s["legal_compliance"] = (
        f"{name} treats compliance as a foundation, not an afterthought.\n\n"
        f"- Company formation and IP assignment completed in {country}.\n"
        f"- Privacy and data handling aligned with the markets served.\n"
        f"- Review of {ind}-specific regulations before entering the market.\n\n"
        f"Advisors and legal counsel are engaged early to keep costs predictable."
    )

    s["team_org"] = (
        f"The founding team of {name} currently numbers {inp.team_size}.\n\n"
        f"- Founder(s): own vision, product and fundraising.\n"
        f"- Core team: the skills needed to ship the minimum lovable product.\n"
        f"- Advisors: domain and operational experience on call.\n\n"
        f"The organization is flat and outcome-driven; roles grow from the plan, not the other way around."
    )

    s["hiring_plan"] = (
        f"Hiring at {name} follows the milestones, not the calendar.\n\n"
        f"- Hire only for roles that unblock the current milestone.\n"
        f"- Prioritize generalist-specialists who can own outcomes end to end.\n"
        f"- Use the funding plan to size the team realistically.\n\n"
        f"Reference the team recommendations section for the full hiring plan."
    )

    s["financial_summary"] = (
        f"{name} projects {_money(fin['year1_revenue'])} revenue in year one, "
        f"{_money(fin['year2_revenue'])} in year two and {_money(fin['year3_revenue'])} in year three.\n\n"
        f"- Monthly burn: {_money(fin['monthly_budget'])}.\n"
        f"- Operational break-even: {breakeven}.\n"
        f"- Runway at current plan: {runway}.\n\n"
        f"These figures are planning estimates built on the assumptions documented with the financial projection."
    )

    s["funding_requirements"] = (
        f"{name} is raising {_money(inp.funding_goal)} to reach the next set of milestones.\n\n"
        f"- Product development: {_money(fin['use_of_funds'][0]['amount'])} ({fin['use_of_funds'][0]['percent']}%).\n"
        f"- Hiring & team: {_money(fin['use_of_funds'][1]['amount'])} ({fin['use_of_funds'][1]['percent']}%).\n"
        f"- Marketing & growth: {_money(fin['use_of_funds'][2]['amount'])} ({fin['use_of_funds'][2]['percent']}%).\n"
        f"- Operations: {_money(fin['use_of_funds'][3]['amount'])} ({fin['use_of_funds'][3]['percent']}%).\n\n"
        f"Funds are allocated to extend the runway through the next measurable proof point."
    )

    s["milestones"] = (
        f"{name} tracks progress against clear milestones:\n\n"
        f"- Month 1–3: ship the minimum lovable product and complete 20 discovery interviews.\n"
        f"- Month 4–6: reach 100 active users and prove a repeatable acquisition channel.\n"
        f"- Month 7–12: achieve {breakeven.replace('month ', 'operational break-even in month ')} and expand the team.\n"
        f"- Year 2: open an adjacent market or segment and prepare for the next round.\n\n"
        f"Milestones are reviewed monthly with a simple scorecard."
    )

    s["risks"] = (
        f"The principal risks for {name} and the mitigations are:\n\n"
        f"- Execution risk: ship fast, measure honestly, kill what does not work.\n"
        f"- Market risk: validate demand with real customers before scaling spend.\n"
        f"- Team risk: hire deliberately and document the business to reduce key-person exposure.\n"
        f"- Financial risk: manage burn tightly and keep runway visibility weekly.\n\n"
        f"See the AI recommendations section for a detailed risk review."
    )

    s["exit_strategy"] = (
        f"{name} builds a business that is attractive to acquirers and, over the long term, a potential public "
        f"company. Likely outcomes include:\n\n"
        f"- Strategic acquisition by an incumbent in the {ind} space.\n"
        f"- Secondary sale or merger once scale is proven.\n"
        f"- Long-term independent growth as a category leader.\n\n"
        f"Exit readiness is maintained through clean cap table, solid unit economics and strong documentation."
    )

    return [{"key": key, "title": title, "content": s[key]} for key, title in SECTION_KEYS]


# ---------------------------------------------------------------------------
# Pitch deck (12 slides)
# ---------------------------------------------------------------------------

def _build_pitch_deck(inp: PlanInputs, fin: dict) -> list[dict]:
    name = inp.startup_name
    aud = _audience(inp)
    country = inp.country
    ind = inp.industry or "target"
    model = MODEL_LABELS[inp.business_model]
    breakeven = f"month {fin['break_even_month']}" if fin.get("break_even_month") else "beyond 12 months"
    team_total = inp.team_size + sum(r["count"] for r in _team_recommendations(inp))

    slides = [
        {
            "key": "title",
            "title": name,
            "bullets": [
                f"Building a {ind} solution for {aud}",
                f"Based in {country} · {STAGE_LABELS[inp.stage]}",
            ],
            "note": "Opening slide: one line on the opportunity, one line on the team.",
        },
        {
            "key": "problem",
            "title": "The Problem",
            "bullets": [
                f"{aud.capitalize()} waste time and money on workarounds",
                "Existing solutions are fragmented, expensive and slow",
                "Incumbents rarely build for the modern user",
            ],
            "note": "Lead with a concrete pain a real user described, not abstract market data.",
        },
        {
            "key": "solution",
            "title": "The Solution",
            "bullets": [
                f"{name} removes the friction with a focused, {model} product",
                "Designed specifically for the workflow of the target customer",
                "Ships incrementally so every release is validated",
            ],
            "note": "Show a demo or screenshot if available — proof beats promises.",
        },
        {
            "key": "market",
            "title": "Market Opportunity",
            "bullets": [
                f"Large, growing spend in the {ind} category",
                f"SAM that {name}'s model can realistically serve",
                f"Projected year-3 revenue: {_money(fin['year3_revenue'])}",
            ],
            "note": "TAM → SAM → SOM in three lines; the SOM line is the credible one.",
        },
        {
            "key": "product",
            "title": "Product",
            "bullets": [
                "Minimum lovable feature set, shipped and measured",
                "Onboarding → activation → retention built into the loop",
                "Roadmap: validate, adopt, then scale",
            ],
            "note": "Describe the current build state honestly (live, beta, or in development).",
        },
        {
            "key": "traction",
            "title": "Traction",
            "bullets": [
                "Discovery interviews with target users to validate the problem",
                "Early design partners and waitlist signals",
                "Metrics published monthly to build investor confidence",
            ],
            "note": "Real numbers beat ambition; even 20 strong interviews are traction at this stage.",
        },
        {
            "key": "business_model",
            "title": "Business Model",
            "bullets": [
                f"Revenue model: {model}",
                "Core revenue with expansion upside as customers grow",
                "Unit economics tracked from the first paying customer",
            ],
            "note": "Show how one unit of revenue is earned, and why margin improves over time.",
        },
        {
            "key": "financials",
            "title": "Financials",
            "bullets": [
                f"Year-1 revenue forecast: {_money(fin['year1_revenue'])}",
                f"Monthly burn: {_money(fin['monthly_budget'])}",
                f"Operational break-even: {breakeven}",
            ],
            "note": "Keep it simple: revenue, burn, break-even and how the raise extends the runway.",
        },
        {
            "key": "team",
            "title": "Team",
            "bullets": [
                f"{inp.team_size} founding members today",
                "Lean senior team owning outcomes end to end",
                f"Planned team of {team_total} across the milestones",
            ],
            "note": "Highlight relevant experience and why this team is the right one for this problem.",
        },
        {
            "key": "competition",
            "title": "Competition",
            "bullets": [
                "Direct, indirect and substitute competitors identified",
                "Differentiation: focus on the segment incumbents underserve",
                "Honest assessment of what competitors do better",
            ],
            "note": "A competitive landscape slide is credible when it is honest.",
        },
        {
            "key": "roadmap",
            "title": "Roadmap",
            "bullets": [
                "Months 1–3: ship MVP and complete 20 discovery interviews",
                "Months 4–6: 100 active users and a repeatable channel",
                "Months 7–12: break even and expand the team",
            ],
            "note": "Roadmap must map 1:1 to the use-of-funds slide.",
        },
        {
            "key": "ask",
            "title": "The Ask",
            "bullets": [
                f"Raising {_money(inp.funding_goal)}",
                "Extends the runway through the next measurable proof point",
                "Product 50% · Team 20% · Marketing 20% · Ops 10%",
            ],
            "note": "End with a specific, credible ask and the single outcome this round unlocks.",
        },
    ]
    return slides


# ---------------------------------------------------------------------------
# Offline plan assembly
# ---------------------------------------------------------------------------

def _build_offline_plan(inp: PlanInputs) -> dict:
    fin = _compute_financials(inp)
    return {
        "business_plan": _build_sections(inp, fin),
        "pitch_deck": _build_pitch_deck(inp, fin),
        "financial_projection": fin,
        "team_recommendations": _team_recommendations(inp),
        "investor_readiness": _readiness(inp, fin),
        "ai_recommendations": _ai_recommendations(inp, fin),
    }


# ---------------------------------------------------------------------------
# AI enhancement (best-effort, merged per section)
# ---------------------------------------------------------------------------

def _extract_json(text: str) -> dict | None:
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
        return data if isinstance(data, dict) else None
    except Exception:
        return None


def _clean_markdown(value) -> str:
    if not isinstance(value, str):
        return ""
    return value.strip()


def _ai_prompt(inp: PlanInputs, fin: dict) -> str:
    keys = ", ".join(f'"{key}"' for key, _ in SECTION_KEYS)
    fin_brief = (
        f"Year-1 revenue {_money(fin['year1_revenue'])}; monthly burn {_money(fin['monthly_budget'])}; "
        f"break-even month {fin.get('break_even_month') or 'beyond 12'}; "
        f"funding ask {_money(fin['funding_requirement'])}."
    )
    return (
        "You are a world-class startup strategist and pitch coach. Using ONLY the inputs below, write the complete "
        "content of a business plan. Return a SINGLE JSON object with no commentary before or after.\n\n"
        f"INPUTS\n- Startup name: {inp.startup_name}\n- Idea: {inp.idea or '(not provided)'}\n"
        f"- Industry: {inp.industry or '(not provided)'}\n- Country: {inp.country}\n"
        f"- Target audience: {inp.target_audience or '(not provided)'}\n- Stage: {inp.stage}\n"
        f"- Business model: {inp.business_model}\n- Team size: {inp.team_size}\n"
        f"- Funding goal: ${inp.funding_goal:,}\n- Monthly budget: ${inp.budget:,}\n"
        f"FINANCIAL CONTEXT\n{fin_brief}\n\n"
        'JSON SCHEMA\n{\n'
        f'  "sections": [{{"key": <one of {keys}>, "title": string, "content": string (2-5 sentences or a '
        'paragraph with "\\n- " bullets)}}],\n'
        '  "pitch_deck": [{"key": string, "title": string, "bullets": [string x3-4], "note": string}],\n'
        '  "team_recommendations": [{"role": string, "seniority": string, "count": number, "remote_ok": boolean, '
        '"reason": string}],\n'
        '  "ai_recommendations": {"missing_features": [string], "weaknesses": [string], "improvements": [string], '
        '"risks": [string], "scaling_plan": [string], "internationalization": [string]}\n'
        "}\n"
        "Provide exactly 30 sections in the given key order, 12 pitch deck slides, 8 team roles, and 4+ items per "
        "AI recommendation list. Be specific, actionable and grounded in the inputs."
    )


def _merge_ai(offline: dict, ai: dict | None) -> dict:
    if not ai:
        return offline

    merged = {
        "business_plan": offline["business_plan"],
        "pitch_deck": offline["pitch_deck"],
        "financial_projection": offline["financial_projection"],
        "team_recommendations": offline["team_recommendations"],
        "investor_readiness": offline["investor_readiness"],
        "ai_recommendations": offline["ai_recommendations"],
    }

    ai_sections = {s.get("key"): s for s in ai.get("sections") or [] if isinstance(s, dict)}
    new_sections = []
    for section in offline["business_plan"]:
        incoming = ai_sections.get(section["key"])
        if incoming and _clean_markdown(incoming.get("content")):
            new_sections.append(
                {"key": section["key"], "title": _clean_markdown(incoming.get("title")) or section["title"],
                 "content": _clean_markdown(incoming.get("content"))}
            )
        else:
            new_sections.append(section)
    merged["business_plan"] = new_sections

    ai_deck = ai.get("pitch_deck") or []
    if isinstance(ai_deck, list) and ai_deck:
        by_key = {}
        for slide in ai_deck:
            if isinstance(slide, dict) and slide.get("key"):
                by_key[slide["key"]] = slide
        deck = []
        for slide in offline["pitch_deck"]:
            incoming = by_key.get(slide["key"])
            if incoming and incoming.get("bullets"):
                deck.append(
                    {"key": slide["key"], "title": _clean_markdown(incoming.get("title")) or slide["title"],
                     "bullets": [b for b in (incoming.get("bullets") or []) if isinstance(b, str)][:6],
                     "note": _clean_markdown(incoming.get("note")) or slide.get("note")}
                )
            else:
                deck.append(slide)
        merged["pitch_deck"] = deck

    ai_team = ai.get("team_recommendations") or []
    if isinstance(ai_team, list) and len(ai_team) >= 8:
        roles = []
        for r in ai_team[:8]:
            if isinstance(r, dict) and r.get("role"):
                roles.append({
                    "role": _clean_markdown(r.get("role")) or "Role",
                    "seniority": _clean_markdown(r.get("seniority")) or "Mid",
                    "count": int(r.get("count") or 1) or 1,
                    "remote_ok": bool(r.get("remote_ok")),
                    "reason": _clean_markdown(r.get("reason")) or "",
                })
        if len(roles) == 8:
            merged["team_recommendations"] = roles

    ai_recs = ai.get("ai_recommendations")
    if isinstance(ai_recs, dict):
        clean_recs = {}
        for cat in ("missing_features", "weaknesses", "improvements", "risks", "scaling_plan", "internationalization"):
            items = [i for i in (ai_recs.get(cat) or []) if isinstance(i, str) and i.strip()]
            if items:
                clean_recs[cat] = items[:6]
        if clean_recs:
            merged["ai_recommendations"] = clean_recs

    ai_summary = (ai.get("investor_readiness") or {}).get("summary")
    if isinstance(ai_summary, str) and ai_summary.strip():
        merged["investor_readiness"]["summary"] = ai_summary.strip()

    return merged


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def generate_business_plan(user_id: str, startup_name: str, idea: str, **kw) -> tuple[dict, str]:
    """Generate a full business plan. Returns (plan_payload, provider)."""
    inp = PlanInputs(startup_name, idea, **kw)
    offline = _build_offline_plan(inp)

    provider = "offline"
    enhanced = None
    if user_id:
        try:
            prompt = _ai_prompt(inp, offline["financial_projection"])
            output = generate_text_sync(user_id, prompt)
            enhanced = _extract_json(output)
            provider = "ai"
        except Exception:
            enhanced = None
            provider = "offline"

    plan = _merge_ai(offline, enhanced)
    plan["provider"] = provider
    plan["inputs"] = inp.to_dict()
    return plan, provider


def new_share_token() -> str:
    return secrets.token_urlsafe(24)


