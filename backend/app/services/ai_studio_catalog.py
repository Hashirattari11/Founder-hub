"""Role-Based AI Studio — data-driven tool catalog.

Every AI tool is declared here as data. The backend exposes the tools for a
user based on their roles; administrators can enable/disable tools or add
custom tools at runtime without touching the frontend.

Role slugs (must match the `roles` table):
  founder, developer, designer, marketer, investor, legal_advisor,
  business_analyst, mentor, recruiter, administrator
Tools listed under the "common" role are available to every user.
"""
from dataclasses import dataclass, field
from typing import Optional


@dataclass
class ToolField:
    key: str
    label: str
    type: str = "text"  # text | textarea | number | select
    required: bool = False
    placeholder: str = ""
    options: Optional[list[str]] = None


@dataclass
class AITool:
    slug: str
    name: str
    description: str
    category: str
    roles: list[str]
    prompt: str
    fields: list[ToolField] = field(default_factory=list)
    icon: str = "Sparkles"
    output_format: str = "markdown"


COMMON = ["common"]

# ---------------------------------------------------------------------------
# Shared field bundles
# ---------------------------------------------------------------------------
def _f(key, label, ftype="text", required=False, placeholder="", options=None):
    return ToolField(key, label, ftype, required, placeholder, options)


F_IDEA = [_f("idea", "Startup idea", "textarea", True, "What are you building, for whom, and why?")]
F_IDEA_STAGE = F_IDEA + [
    _f("stage", "Stage", "select", False, "", ["idea", "mvp", "traction", "growth", "scale"])
]
F_IDEA_MARKET = F_IDEA + [_f("market", "Target market", "text", False, "e.g. SMEs in Nairobi")]
F_PRODUCT_AUDIENCE = [
    _f("product", "Product / service", "textarea", True, "What are you selling?"),
    _f("audience", "Target audience", "text", False, "Who is it for?"),
]
F_CODE = [_f("code", "Code", "textarea", True, "Paste the code you want analyzed")]
F_STARTUP = [_f("startup_desc", "Startup description", "textarea", True, "Describe the startup to analyze")]
F_DATA = [_f("data_desc", "Data / metrics description", "textarea", True, "Describe the data and any numbers you have")]


def t(
    slug: str,
    name: str,
    category: str,
    roles: list[str],
    prompt: str,
    desc: str = "",
    fields: Optional[list[ToolField]] = None,
    icon: str = "Sparkles",
    output_format: str = "markdown",
) -> AITool:
    return AITool(slug, name, desc, category, roles, prompt, fields or [], icon, output_format)


# ---------------------------------------------------------------------------
# FOUNDER AI STUDIO (18)
# ---------------------------------------------------------------------------
FOUNDER = [
    t("generate_business_plan", "Generate Business Plan", "Strategy", ["founder"],
      "Write a complete, investor-ready business plan for: {idea}\n\n"
      "Cover: problem, solution, target market, business model, revenue streams, "
      "competitive landscape, go-to-market, operations, team, financial projections, "
      "funding ask, risks and mitigation. Use clear section headings.",
      "Full 30+ section investor-ready business plan.", F_IDEA, "FileText"),
    t("generate_pitch_deck", "Generate Pitch Deck", "Strategy", ["founder"],
      "Create a compelling 12-slide investor pitch deck outline for: {idea}\n\n"
      "Slides: Title, Problem, Solution, Market, Product, Traction, Business Model, "
      "Competition, Team, Financials, The Ask, Vision. For each slide give a punchy "
      "headline and 3 supporting bullet points.",
      "Slide-by-slide pitch deck with speaker notes.", F_IDEA_STAGE, "Presentation"),
    t("generate_financial_projection", "Generate Financial Projection", "Finance", ["founder"],
      "Build a 3-year financial projection for: {idea}\n\n"
      "Revenue model: {model}. Monthly budget: {budget}.\n"
      "Include: monthly revenue ramp, expense breakdown, cash flow, break-even point, "
      "burn rate, funding requirement and key assumptions.",
      "3-year projections with break-even and burn analysis.", F_IDEA + [
        _f("model", "Revenue model", "text", False, "e.g. SaaS subscription"),
        _f("budget", "Monthly budget ($)", "number", False, "e.g. 12000"),
      ], "Calculator"),
    t("startup_validator", "Startup Validator", "Strategy", ["founder"],
      "Critically validate this startup idea: {idea}\n\n"
      "Market: {market}\n"
      "Score it honestly across: problem realness, willingness to pay, market size, "
      "feasibility, competitive differentiation, and timing. Give a 0-100 score, "
      "the biggest risks, and what to validate next.",
      "Honest scorecard with the biggest risks to de-risk first.", F_IDEA_MARKET, "CheckCircle2"),
    t("startup_health_score", "Startup Health Score", "Analytics", ["founder"],
      "Score the health of this startup: {idea}\n\n"
      "Metrics to consider: {metrics}\n"
      "Evaluate across: product-market fit, growth rate, unit economics, team, cash "
      "position, and traction. Output a 0-100 health score, a diagnosis per pillar, "
      "and the top 3 actions to raise the score.",
      "0-100 health score with pillar diagnosis and actions.", F_IDEA + [
        _f("metrics", "Known metrics", "textarea", False, "Revenue, growth %, burn, churn, retention...")
      ], "Activity"),
    t("investor_matching", "Investor Matching", "Fundraising", ["founder"],
      "Idea: {idea}\nFunding goal: {funding_goal} | Stage: {stage}\n\n"
      "Recommend the ideal investor profile for this startup: investor types, "
      "stage focus, typical check sizes, sectors, geography, and how to approach them. "
      "Also list 10 specific investors that fit, with reasoning.",
      "Ideal investor profile + specific investor shortlist.", F_IDEA_STAGE + [
        _f("funding_goal", "Funding goal ($)", "number", False, "e.g. 250000")
      ], "Handshake"),
    t("funding_strategy", "Funding Strategy", "Fundraising", ["founder"],
      "Design a funding strategy for: {idea}\n\n"
      "Goal: {funding_goal} | Stage: {stage}\n"
      "Recommend the optimal round structure, pre-money valuation range, dilution "
      "that keeps the founder in control, investor mix, deck ask, timeline, and a "
      "pitch script for the first meeting.",
      "Round structure, valuation range and pitch strategy.", F_IDEA_STAGE + [
        _f("funding_goal", "Funding goal ($)", "number", False, "e.g. 250000")
      ], "TrendingUp"),
    t("revenue_forecast", "Revenue Forecast", "Finance", ["founder"],
      "Forecast revenue for: {idea}\n\n"
      "Revenue model: {model} | Monthly budget: {budget}\n"
      "Project 12 months of revenue with monthly breakdowns, growth assumptions, "
      "unit economics (CAC, LTV), scenarios (base, conservative, optimistic), and "
      "the assumptions that would break the model.",
      "12-month revenue forecast with scenarios and unit economics.", F_IDEA + [
        _f("model", "Revenue model", "text", False, "e.g. marketplace commission"),
        _f("budget", "Monthly budget ($)", "number", False, "e.g. 8000")
      ], "LineChart"),
    t("competitor_analysis", "Competitor Analysis", "Market", ["founder"],
      "Analyze the competitive landscape for: {idea}\n\n"
      "Known competitors: {competitors}\n"
      "For each competitor: positioning, pricing, strengths, weaknesses, and the "
      "gap this startup can own. Conclude with a defensible differentiation strategy.",
      "Competitive matrix with a defensible differentiation strategy.", F_IDEA + [
        _f("competitors", "Known competitors", "textarea", False, "List competitors you know")
      ], "Swords"),
    t("swot_analysis", "SWOT Analysis", "Strategy", ["founder"],
      "Run a SWOT analysis for: {idea}\n\n"
      "Cover: Strengths, Weaknesses, Opportunities and Threats. For each, give 3-5 "
      "specific points plus an action to exploit strengths/opportunities and "
      "mitigate weaknesses/threats.",
      "SWOT with actionable next steps per quadrant.", F_IDEA_MARKET, "Crosshair"),
    t("go_to_market", "Go To Market Strategy", "Market", ["founder"],
      "Create a go-to-market strategy for: {idea}\n\n"
      "Audience: {audience} | Market: {country}\n"
      "Cover: positioning, ICP, channels, launch sequence (first 90 days), "
      "pricing, content and community plan, success metrics and budget split.",
      "90-day launch plan with channels, pricing and budget.", F_IDEA + [
        _f("audience", "Target audience", "text", False, "e.g. SMB restaurant owners"),
        _f("country", "Primary market", "text", False, "e.g. Kenya"),
      ], "Rocket"),
    t("hiring_roadmap", "Hiring Roadmap", "Team", ["founder"],
      "Build a hiring roadmap for: {idea}\n\n"
      "Current team size: {team_size} | Roles needed: {roles_needed}\n"
      "Recommend the order of hires by impact, role specs (skills + seniority + "
      "salary bands for the market), where to source candidates, equity/ESOP "
      "allocation per hire, and a 12-month hiring timeline.",
      "Ordered hiring plan with salary bands and equity guidance.", F_IDEA + [
        _f("team_size", "Current team size", "number", False, "e.g. 3"),
        _f("roles_needed", "Roles needed", "text", False, "e.g. full-stack dev, marketer"),
      ], "Users"),
    t("startup_roadmap", "Startup Roadmap", "Strategy", ["founder"],
      "Create a 12-month product and business roadmap for: {idea}\n\n"
      "Stage: {stage}\n"
      "Break it into quarterly phases: goals, key features, business milestones, "
      "team needs, funding needs and success metrics for each quarter.",
      "Quarterly 12-month roadmap with goals and metrics.", F_IDEA_STAGE, "Map"),
    t("ai_board_advisor", "AI Board Advisor", "Advice", ["founder"],
      "Act as a seasoned startup board advisor. For: {idea}\n\n"
      "My question: {question}\n"
      "Give direct, specific advice: what to do, what to avoid, tradeoffs, and the "
      "metrics I should watch.",
      "Direct strategic advice on your specific question.", F_IDEA + [
        _f("question", "Your question", "textarea", True, "e.g. Should we raise now or grow revenue first?")
      ], "Brain"),
    t("executive_summary", "Generate Executive Summary", "Strategy", ["founder"],
      "Write a one-page executive summary for: {idea}\n\n"
      "Distill the problem, solution, market, traction, business model, team, "
      "financial ask and vision into a tight, investor-ready summary under 400 words.",
      "One-page investor-ready executive summary.", F_IDEA, "FileText"),
    t("vision_mission", "Generate Vision & Mission", "Brand", ["founder"],
      "Craft vision and mission statements for: {idea}\n\n"
      "Write a bold 10-year vision, a clear mission statement, core values (5-7), "
      "and a one-line brand promise. Explain how each connects to the product.",
      "Vision, mission, values and brand promise.", F_IDEA, "Target"),
    t("okrs", "Generate OKRs", "Strategy", ["founder"],
      "Create quarterly OKRs for: {idea}\n\n"
      "Stage: {stage} | Focus: {focus}\n"
      "Give 3 objectives with 2-3 measurable key results each, plus a quarterly "
      "cadence for review.",
      "Quarterly OKRs with measurable key results.", F_IDEA + [
        _f("stage", "Stage", "select", False, "", ["idea", "mvp", "traction", "growth", "scale"]),
        _f("focus", "Focus area", "text", False, "e.g. growth, retention, hiring"),
      ], "Target"),
    t("export_pdf", "Export PDF", "Exports", ["founder"],
      "Produce a clean, professionally formatted business document for: {idea}\n\n"
      "Sections: Executive Summary, Problem, Solution, Market, Business Model, "
      "Financials, Team, Roadmap, Funding Ask.",
      "Print-ready formatted PDF document.", F_IDEA, "Download"),
]


# ---------------------------------------------------------------------------
# DEVELOPER AI STUDIO (15)
# ---------------------------------------------------------------------------
DEVELOPER = [
    t("full_stack_code", "Generate Full Stack Code", "Code", ["developer"],
      "Write production-quality {stack} full-stack code for: {feature}\n\n"
      "Include folder structure, key files with real implementations, API routes, "
      "data models, auth considerations and how to run it.",
      "Real full-stack implementation with structure and run instructions.",
      [_f("feature", "Feature to build", "textarea", True, "e.g. user onboarding with email verification"),
       _f("stack", "Stack", "text", False, "e.g. React + FastAPI + PostgreSQL")], "Code2"),
    t("react_components", "Generate React Components", "Code", ["developer"],
      "Write clean, typed React + TypeScript components for: {component_desc}\n\n"
      "Include props interface, state management, styling (Tailwind), accessibility, "
      "and usage examples. No placeholders.",
      "Typed React components with props, state and usage.",
      [_f("component_desc", "Component description", "textarea", True, "e.g. a dashboard metrics card with sparkline")],
      "Component"),
    t("fastapi_api", "Generate FastAPI APIs", "Code", ["developer"],
      "Build FastAPI endpoints for resource: {resource}\n\n"
      "Model fields: {model_fields}\n"
      "Provide Pydantic schemas, CRUD routes, auth dependency, error handling, "
      "pagination and a Supabase/Postgres integration example.",
      "FastAPI CRUD with schemas, auth and error handling.",
      [_f("resource", "Resource", "text", True, "e.g. orders"),
       _f("model_fields", "Model fields", "textarea", False, "e.g. id, user_id, total, status, created_at")],
      "Server"),
    t("sql", "Generate SQL", "Code", ["developer"],
      "Write optimized PostgreSQL/Supabase SQL for: {schema_desc}\n\n"
      "Include table DDL, indexes, RLS policies, and one or two analytics queries. "
      "Explain the design choices.",
      "Optimized SQL with DDL, indexes, RLS and queries.",
      [_f("schema_desc", "What to model", "textarea", True, "e.g. a job board with users, jobs, applications")],
      "Database"),
    t("db_schema", "Generate Database Schema", "Code", ["developer"],
      "Design a database schema for: {domain}\n\n"
      "Tables to model: {tables}\n"
      "Give the full schema: tables, columns, types, primary/foreign keys, indexes, "
      "and relationships as text, plus the SQL to create it.",
      "Complete schema design with SQL DDL.",
      [_f("domain", "Domain", "text", True, "e.g. marketplace"),
       _f("tables", "Entities to model", "text", False, "e.g. users, listings, orders, reviews")],
      "Database"),
    t("documentation", "Generate Documentation", "Docs", ["developer"],
      "Write clear technical documentation for:\n{code_snippet}\n\n"
      "Cover: purpose, how it works, API reference if applicable, edge cases, and "
      "a quick-start example.",
      "Clear technical docs for the provided code.",
      [_f("code_snippet", "Code / module", "textarea", True, "Paste code or describe the module")], "FileText"),
    t("review_code", "Review Code", "Code", ["developer"],
      "Review this code for bugs, security issues, performance problems, and "
      "readability:\n\n{code}\n\n"
      "Give a severity-ranked list of issues, line-level suggestions, and a fixed "
      "version for the top 3 issues.",
      "Severity-ranked review with fixes for top issues.", F_CODE, "SearchCheck"),
    t("fix_bugs", "Fix Bugs", "Code", ["developer"],
      "Fix the bugs in this code:\n\n{code}\n\n"
      "Observed error: {error}\n"
      "Explain the root cause for each bug, then show the corrected code.",
      "Root-cause analysis plus corrected code.",
      F_CODE + [_f("error", "Observed error", "text", False, "e.g. KeyError on missing field")], "Bug"),
    t("unit_tests", "Generate Unit Tests", "Code", ["developer"],
      "Write comprehensive unit tests for:\n\n{code}\n\n"
      "Framework: {framework}\n"
      "Cover happy paths, edge cases, and failure cases. Use good test naming and "
      "mocking where needed.",
      "Unit tests covering happy, edge and failure paths.",
      F_CODE + [_f("framework", "Test framework", "text", False, "e.g. pytest")], "FlaskConical"),
    t("api_docs", "Generate API Documentation", "Docs", ["developer"],
      "Write API documentation for:\n\n{endpoint_desc}\n\n"
      "Include endpoint list, request/response examples, auth, error codes, and "
      "usage examples.",
      "Endpoint reference with examples and error codes.",
      [_f("endpoint_desc", "API to document", "textarea", True, "e.g. POST /api/orders + GET /api/orders/{id}")],
      "FileText"),
    t("architecture_review", "Architecture Review", "Code", ["developer"],
      "Review the architecture of:\n\n{system_desc}\n\n"
      "Assess modularity, scalability, coupling, data flow, failure points and "
      "tech debt. Give a prioritized improvement roadmap.",
      "Architecture assessment with a prioritized improvement plan.",
      [_f("system_desc", "System description", "textarea", True, "Describe services, data flow, stack")], "Layers"),
    t("deployment", "Deployment Assistant", "DevOps", ["developer"],
      "Create a deployment plan for:\n\n{app_desc}\n\n"
      "Target platform: {platform}\n"
      "Include CI/CD pipeline steps, environment configuration, database "
      "migrations, secrets handling, monitoring, rollback strategy and a pre-launch "
      "checklist.",
      "Step-by-step deployment plan with CI/CD and rollback.",
      [_f("app_desc", "App description", "textarea", True, "Describe the app and stack"),
       _f("platform", "Platform", "text", False, "e.g. Vercel + Supabase, AWS, Railway")],
      "Cloud"),
    t("git_commit", "Git Commit Generator", "DevOps", ["developer"],
      "Write a conventional commit message for the following changes:\n\n{changes_summary}\n\n"
      "Propose a type (feat/fix/refactor/docs/test/chore), a concise subject under "
      "70 chars, and a bulleted body.",
      "Conventional commit message with subject and body.",
      [_f("changes_summary", "What changed", "textarea", True, "Summarize the diffs and intent")], "GitBranch"),
    t("code_optimizer", "Code Optimizer", "Code", ["developer"],
      "Optimize this code for performance and readability:\n\n{code}\n\n"
      "Focus: {bottleneck}\n"
      "Explain the bottlenecks, show the optimized version, and note the expected "
      "improvement.",
      "Optimized code with bottleneck analysis.",
      F_CODE + [_f("bottleneck", "Known bottleneck", "text", False, "e.g. N+1 queries, O(n^2) loop")], "Zap"),
    t("security_scanner", "Security Scanner", "Code", ["developer"],
      "Run a security review of this code:\n\n{code}\n\n"
      "Look for: injection, broken auth, XSS, insecure deserialization, exposed "
      "secrets, insecure dependencies and OWASP Top 10 issues. Rate severity and "
      "provide fixes.",
      "OWASP-focused security findings with fixes.",
      F_CODE + [_f("language", "Language / framework", "text", False, "e.g. Python/FastAPI")], "Shield"),
]


# ---------------------------------------------------------------------------
# DESIGNER AI STUDIO (13)
# ---------------------------------------------------------------------------
DESIGNER = [
    t("ui_design", "Generate UI Design", "Design", ["designer"],
      "Design a modern {style} UI for: {screen}\n\n"
      "Provide: layout structure, component breakdown, spacing/typography system, "
      "state variations (empty, loading, error), and interaction notes.",
      "Detailed UI spec with components and states.",
      [_f("screen", "Screen to design", "textarea", True, "e.g. onboarding flow with 3 steps"),
       _f("style", "Design style", "text", False, "e.g. minimal glassmorphism, bold neobrutalism")],
      "Layout"),
    t("mobile_design", "Generate Mobile Design", "Design", ["designer"],
      "Design a {platform} mobile UI for: {screen}\n\n"
      "Include navigation pattern, screen-by-screen layout, touch targets, gestures, "
      "and platform-specific guidelines (safe areas, system fonts, dark mode).",
      "Mobile-first UI spec with platform guidance.",
      [_f("screen", "Screen / flow", "textarea", True, "e.g. fitness tracking app home + workout screens"),
       _f("platform", "Platform", "select", False, "", ["iOS", "Android", "Both"])],
      "Smartphone"),
    t("dashboard_design", "Generate Dashboard", "Design", ["designer"],
      "Design a dashboard for: {purpose}\n\n"
      "Key metrics: {metrics}\n"
      "Provide information hierarchy, card layout, chart choices per metric, "
      "empty/loading states, and a visual hierarchy for the most important number.",
      "Dashboard layout with chart recommendations.",
      [_f("purpose", "Dashboard purpose", "text", True, "e.g. SaaS revenue dashboard"),
       _f("metrics", "Key metrics", "text", False, "e.g. MRR, active users, churn, CAC")],
      "LayoutDashboard"),
    t("landing_page", "Generate Landing Page", "Design", ["designer"],
      "Design a high-converting landing page for: {product}\n\n"
      "Audience: {audience}\n"
      "Give the full section-by-section structure (hero, social proof, features, "
      "pricing, FAQ, CTA), copy tone, and visual direction.",
      "Section-by-section landing page structure.",
      [_f("product", "Product", "textarea", True, "What is the product?"),
       _f("audience", "Audience", "text", False, "e.g. early-stage founders")],
      "Layout"),
    t("wireframe", "Generate Wireframe", "Design", ["designer"],
      "Create a low-fidelity wireframe plan for: {screen}\n\n"
      "Flow: {flow}\n"
      "Describe each screen as blocks with annotations: header, nav, content "
      "zones, primary CTAs, and priority ordering.",
      "Annotated wireframe plan per screen.",
      [_f("screen", "Screen", "textarea", True, "e.g. checkout flow"),
       _f("flow", "User flow", "text", False, "e.g. cart -> shipping -> payment -> confirmation")],
      "Frame"),
    t("user_flow", "Generate User Flow", "Design", ["designer"],
      "Design a user flow for: {journey}\n\n"
      "Map every step, decision point, screen, and edge case. Include the "
      "happy path, error paths, and where to add delight moments.",
      "Complete journey map with decision and error paths.",
      [_f("journey", "User journey", "textarea", True, "e.g. new user signup to first purchase")], "GitFork"),
    t("logo", "Generate Logo", "Brand", ["designer"],
      "Concept a logo for: {brand}\n\n"
      "Style: {style}\n"
      "Provide 3 directions with: symbol idea, typography pairing, color meaning, "
      "and how it scales from favicon to billboard.",
      "Logo directions with symbols, type and scaling notes.",
      [_f("brand", "Brand / company", "text", True, "e.g. Atlas Logistics"),
       _f("style", "Style", "text", False, "e.g. minimal, geometric, playful")],
      "PenTool"),
    t("brand_kit", "Generate Brand Kit", "Brand", ["designer"],
      "Build a brand kit for: {brand}\n\n"
      "Audience: {audience}\n"
      "Include: brand personality, logo usage rules, color palette with hex codes, "
      "typography scale, voice & tone, imagery style, and do's & don'ts.",
      "Full brand kit with color, type and voice.",
      [_f("brand", "Brand", "text", True, "e.g. FinTrack"),
       _f("audience", "Audience", "text", False, "e.g. personal finance app for Gen Z")],
      "Palette"),
    t("icons", "Generate Icons", "Design", ["designer"],
      "Design a set of {count} icons for: {theme}\n\n"
      "Define the icon grid, stroke weight, corner radius, and visual style. "
      "List each icon name with a one-line sketch description.",
      "Icon set spec with grid and stroke guidelines.",
      [_f("theme", "Icon theme", "text", True, "e.g. fintech, healthcare, fitness"),
       _f("count", "Number of icons", "number", False, "e.g. 20")],
      "Grid3x3"),
    t("design_system", "Generate Design System", "Design", ["designer"],
      "Create a design system foundation for: {product}\n\n"
      "Style: {style}\n"
      "Cover: design tokens (color, space, type, radius, shadows), component "
      "inventory, states and usage rules, dark/light theming, and accessibility "
      "baselines.",
      "Design token + component system specification.",
      [_f("product", "Product", "text", True, "e.g. SaaS admin portal"),
       _f("style", "Style", "text", False, "e.g. modern minimal")],
      "Layers"),
    t("color_palette", "Generate Color Palette", "Brand", ["designer"],
      "Create a color palette for: {brand}\n\n"
      "Mood: {mood}\n"
      "Give a full palette: primary, secondary, accent, neutrals (with light/dark "
      "variants), success/warning/danger, hex codes, contrast ratios, and where "
      "each color should be used.",
      "Complete accessible palette with hex codes and usage.",
      [_f("brand", "Brand", "text", True, "e.g. Bloom wellness app"),
       _f("mood", "Mood", "text", False, "e.g. calm, trustworthy, energetic")],
      "Palette"),
    t("ux_review", "UX Review", "Design", ["designer"],
      "Review the UX of:\n\n{flow_desc}\n\n"
      "Identify friction points, cognitive load issues, navigation problems, and "
      "conversion blockers. Give prioritized fixes with reasoning.",
      "Prioritized UX issues with fixes.",
      [_f("flow_desc", "Flow / product to review", "textarea", True, "Describe the flow, screens, and goal")],
      "Search"),
    t("accessibility_review", "Accessibility Review", "Design", ["designer"],
      "Run an accessibility audit of:\n\n{interface_desc}\n\n"
      "Check WCAG 2.2 AA: contrast, keyboard navigation, focus states, screen "
      "reader labels, semantic structure, motion and touch targets. List issues "
      "by severity with concrete fixes.",
      "WCAG AA audit with severity-ranked fixes.",
      [_f("interface_desc", "Interface to audit", "textarea", True, "Describe the screens and interactions")],
      "Accessibility"),
]


# ---------------------------------------------------------------------------
# MARKETER AI STUDIO (14)
# ---------------------------------------------------------------------------
MARKETER = [
    t("marketing_strategy", "Marketing Strategy", "Strategy", ["marketer"],
      "Build a marketing strategy for: {product}\n\n"
      "Audience: {audience} | Budget: {budget}\n"
      "Cover: positioning, channels, content pillars, funnel, budget allocation, "
      "90-day plan, KPIs and the one metric that matters.",
      "Full marketing strategy with budget and KPIs.",
      F_PRODUCT_AUDIENCE + [_f("budget", "Monthly budget ($)", "number", False, "e.g. 3000")], "Megaphone"),
    t("content_calendar", "Content Calendar", "Content", ["marketer"],
      "Create a {duration}-week content calendar for: {product}\n\n"
      "Audience: {audience}\n"
      "Give week-by-week themes, specific post ideas per channel, hooks, formats, "
      "and the KPIs to track.",
      "Week-by-week content plan per channel.",
      F_PRODUCT_AUDIENCE + [_f("duration", "Weeks", "number", False, "e.g. 4")], "Calendar"),
    t("facebook_ads", "Facebook Ads", "Ads", ["marketer"],
      "Create a Facebook Ads campaign for: {product}\n\n"
      "Audience: {audience} | Objective: {objective}\n"
      "Provide: 5 ad sets with targeting, 3 ad copy + headline + CTA per set, "
      "creative direction, budget split, and a testing matrix.",
      "Full FB ad campaign with targeting and creative.",
      F_PRODUCT_AUDIENCE + [_f("objective", "Objective", "select", False, "",
        ["Conversions", "Leads", "Traffic", "Awareness"])], "Facebook"),
    t("google_ads", "Google Ads", "Ads", ["marketer"],
      "Create a Google Ads campaign for: {product}\n\n"
      "Keywords: {keywords} | Budget: {budget}\n"
      "Provide: campaign structure, keyword groups with match types, 3 responsive "
      "search ads, negative keywords, bid strategy and landing page guidance.",
      "Structured Google Ads campaign with copy.",
      F_PRODUCT_AUDIENCE + [
        _f("keywords", "Target keywords", "text", False, "e.g. accounting software for freelancers"),
        _f("budget", "Daily budget ($)", "number", False, "e.g. 50")],
      "Search"),
    t("linkedin_posts", "LinkedIn Posts", "Content", ["marketer"],
      "Write {count} LinkedIn posts for: {product}\n\n"
      "Audience: {audience}\n"
      "Vary formats: founder story, insight, case study, question, and CTA. Each "
      "post: hook, 3-5 lines, and a question to drive comments.",
      "LinkedIn post pack with hooks and CTAs.",
      F_PRODUCT_AUDIENCE + [_f("count", "Number of posts", "number", False, "e.g. 5")], "Linkedin"),
    t("instagram_captions", "Instagram Captions", "Content", ["marketer"],
      "Write Instagram captions for: {product}\n\n"
      "Audience: {audience}\n"
      "Give 5 captions (with emoji guidance, hooks, and CTA) plus suggested "
      "hashtag sets and story/reel ideas.",
      "Caption pack with hashtags and reels ideas.",
      F_PRODUCT_AUDIENCE, "Instagram"),
    t("email_campaign", "Email Campaign", "Content", ["marketer"],
      "Write an email campaign for: {product}\n\n"
      "Audience: {audience} | Goal: {goal}\n"
      "Provide: subject line options, preview text, a welcome/launch sequence "
      "(3-5 emails) with full copy, and an A/B test plan.",
      "Email sequence with subject lines and A/B plan.",
      F_PRODUCT_AUDIENCE + [_f("goal", "Goal", "text", False, "e.g. first purchase")], "Mail"),
    t("seo_audit", "SEO Audit", "SEO", ["marketer"],
      "Run an SEO audit plan for: {url}\n\n"
      "Focus: {focus}\n"
      "Cover: technical SEO, on-page optimization, content gaps, keyword "
      "opportunities, backlink strategy and a 30/60/90 day action plan.",
      "Technical + on-page SEO action plan.",
      [_f("url", "Website / page", "text", True, "e.g. https://startup.com"),
       _f("focus", "Focus", "text", False, "e.g. organic blog traffic")],
      "Search"),
    t("keyword_research", "Keyword Research", "SEO", ["marketer"],
      "Research keywords for: {product}\n\n"
      "Industry: {industry}\n"
      "Give a keyword map: head terms, long-tail, and question keywords with "
      "intent, estimated difficulty, and content suggestions for each cluster.",
      "Keyword map with intent and content ideas.",
      F_PRODUCT_AUDIENCE + [_f("industry", "Industry", "text", False, "e.g. fintech")], "Search"),
    t("competitor_marketing", "Competitor Marketing", "Strategy", ["marketer"],
      "Analyze competitors' marketing for: {product}\n\n"
      "Competitors: {competitors}\n"
      "Map each competitor's channels, messaging, offers, ads, content strategy "
      "and gaps. Recommend where to out-position them.",
      "Competitive marketing matrix with positioning plays.",
      F_PRODUCT_AUDIENCE + [_f("competitors", "Competitors", "textarea", False, "List competitors")], "Swords"),
    t("sales_funnel", "Sales Funnel", "Strategy", ["marketer"],
      "Design a sales funnel for: {product}\n\n"
      "Audience: {audience}\n"
      "Map awareness, consideration, decision, and retention stages with: content "
      "and channels per stage, conversion targets, offers/CTAs, and how to "
      "measure and optimize each step.",
      "Full funnel with per-stage content and metrics.",
      F_PRODUCT_AUDIENCE, "Funnel"),
    t("growth_strategy", "Growth Strategy", "Strategy", ["marketer"],
      "Create a growth strategy for: {product}\n\n"
      "Primary metric: {metric}\n"
      "Recommend growth loops (viral, content, paid, partnerships), experiments "
      "for the next 30 days, activation improvements, and retention tactics.",
      "Growth loops and a 30-day experiment plan.",
      F_PRODUCT_AUDIENCE + [_f("metric", "Primary metric", "text", False, "e.g. weekly active users")], "TrendingUp"),
    t("landing_copy", "Landing Page Copy", "Content", ["marketer"],
      "Write high-converting landing page copy for: {product}\n\n"
      "Audience: {audience} | CTA: {cta}\n"
      "Provide: headline options (5), subheadline, hero section copy, 3-5 benefit "
      "blocks, social proof, FAQ (5), and final CTA. Match tone to audience.",
      "Full landing copy with headline variants and FAQ.",
      F_PRODUCT_AUDIENCE + [_f("cta", "Primary CTA", "text", False, "e.g. Start free trial")], "Layout"),
    t("hashtag_generator", "Hashtag Generator", "Content", ["marketer"],
      "Generate {count} hashtags for: {topic}\n\n"
      "Provide a mix: broad, niche, and branded, with expected reach guidance and "
      "where to place them (post, story, reels).",
      "Curated hashtag set with placement guidance.",
      [_f("topic", "Topic / post", "text", True, "e.g. remote work productivity"),
       _f("count", "Count", "number", False, "e.g. 15")],
      "Hash"),
]


# ---------------------------------------------------------------------------
# INVESTOR AI STUDIO (12)
# ---------------------------------------------------------------------------
INVESTOR = [
    t("analyze_startup", "Analyze Startup", "Analysis", ["investor"],
      "Analyze this startup for investment:\n\n{startup_desc}\n\n"
      "Cover: problem, solution, market size, traction, unit economics, team "
      "quality, moat, risks and a clear thesis for or against investing.",
      "Structured startup analysis with investment thesis.", F_STARTUP, "Search"),
    t("risk_analysis", "Risk Analysis", "Analysis", ["investor"],
      "Identify and quantify risks for:\n\n{startup_desc}\n\n"
      "Cover: market, product, execution, financial, regulatory and competitive "
      "risks. Rate each (high/medium/low) and suggest mitigations a fund could require.",
      "Severity-ranked risk register with mitigations.", F_STARTUP, "Shield"),
    t("valuation_estimator", "Valuation Estimator", "Finance", ["investor"],
      "Estimate a valuation for:\n\n{startup_desc}\n\n"
      "Metrics: {metrics} | Industry: {industry}\n"
      "Use comparable and scorecard approaches: revenue multiples, growth rates, "
      "market comps, stage benchmarks. Output a valuation range, the mid-point, "
      "and the assumptions driving it.",
      "Valuation range via comparables and scorecard.",
      F_STARTUP + [
        _f("metrics", "Known metrics", "textarea", False, "Revenue, growth, margins, run rate..."),
        _f("industry", "Industry", "text", False, "e.g. SaaS")],
      "Calculator"),
    t("investment_memo", "Investment Memo", "Finance", ["investor"],
      "Write an investment memo for:\n\n{startup_desc}\n\n"
      "Thesis: {thesis}\n"
      "Include: opportunity, product, market, traction, competition, team, "
      "financials, valuation, risks, terms, and recommended action.",
      "Complete one-pager investment memo.",
      F_STARTUP + [_f("thesis", "Investment thesis", "textarea", False, "Why this could be a 10x")], "FileText"),
    t("due_diligence", "Due Diligence Summary", "Finance", ["investor"],
      "Create a due diligence checklist + summary for:\n\n{startup_desc}\n\n"
      "Organize by: legal, financial, technical, market, team, and cap table. "
      "List red flags to verify and the top questions for management.",
      "DD checklist with red flags and management questions.", F_STARTUP, "ClipboardCheck"),
    t("roi_calculator", "ROI Calculator", "Finance", ["investor"],
      "Model ROI for investing {investment} expecting a {multiple}x return on "
      "startup:\n\n{startup_desc}\n\n"
      "Show expected exit value, holding period, IRR, cash-on-cash return, "
      "downside scenarios and dilution effects.",
      "ROI/IRR model with downside scenarios.",
      F_STARTUP + [
        _f("investment", "Investment amount ($)", "number", False, "e.g. 100000"),
        _f("multiple", "Expected multiple (x)", "number", False, "e.g. 10")],
      "Percent"),
    t("compare_startups", "Compare Startups", "Analysis", ["investor"],
      "Compare these startups:\n\n{startups}\n\n"
      "Build a decision matrix across: market size, traction, unit economics, "
      "team, moat, and risk. Rank them and explain the spread.",
      "Decision-matrix comparison with ranking.",
      [_f("startups", "Startups to compare", "textarea", True, "Describe each startup on its own line")], "GitCompare"),
    t("portfolio_analysis", "Portfolio Analysis", "Analysis", ["investor"],
      "Analyze this portfolio:\n\n{holdings}\n\n"
      "Assess diversification, sector concentration, risk/return profile, stage "
      "spread, and follow-on needs. Recommend rebalancing actions.",
      "Portfolio health with rebalancing recommendations.",
      [_f("holdings", "Portfolio holdings", "textarea", True, "Startup, amount, equity, value if known")],
      "PieChart"),
    t("market_opportunity", "Market Opportunity", "Analysis", ["investor"],
      "Evaluate the market opportunity for:\n\n{startup_desc}\n\n"
      "Market: {market}\n"
      "Size the market (TAM/SAM/SOM), growth rate, trends, willingness to pay, "
      "and how the startup can realistically capture share.",
      "TAM/SAM/SOM with capture path.", F_STARTUP + [
        _f("market", "Market", "text", False, "e.g. global HR software")], "TrendingUp"),
    t("investment_recommendation", "Investment Recommendation", "Finance", ["investor"],
      "Give an investment recommendation for:\n\n{startup_desc}\n\n"
      "Output: PASS / MAYBE / INVEST, a confidence score, proposed terms "
      "(check size, valuation cap, equity), and the conditions to move forward.",
      "Clear PASS/MAYBE/INVEST with proposed terms.", F_STARTUP, "ThumbsUp"),
    t("funding_history", "Funding History", "Analysis", ["investor"],
      "Analyze the funding history signal for:\n\n{startup_desc}\n\n"
      "Interpret the cap table, round sizes, valuations, investor quality and "
      "dilution to judge momentum and whether the team is capital-efficient.",
      "Cap-table and funding signal analysis.", F_STARTUP, "History"),
    t("startup_score", "Startup Score", "Analysis", ["investor"],
      "Score this startup:\n\n{startup_desc}\n\n"
      "Score (0-100) across: team, market, product, traction, unit economics, and "
      "moat. Show the radar breakdown and a one-line verdict per pillar.",
      "0-100 multi-pillar startup score.", F_STARTUP, "Gauge"),
]


# ---------------------------------------------------------------------------
# LEGAL AI STUDIO (9)
# ---------------------------------------------------------------------------
LEGAL = [
    t("nda", "Generate NDA", "Legal", ["legal_advisor"],
      "Draft a mutual non-disclosure agreement.\n\n"
      "Parties: {parties} | Jurisdiction: {jurisdiction}\n"
      "Include: definition of confidential information, exclusions, obligations, "
      "term, return/destruction, no license grant, injunctive relief, governing "
      "law and dispute resolution. Flag any clauses the client should negotiate.",
      "Mutual NDA with standard protections.",
      [_f("parties", "Parties", "text", True, "e.g. Acme Ltd and Beta Inc"),
       _f("jurisdiction", "Jurisdiction", "text", False, "e.g. Delaware, USA")],
      "FileText"),
    t("founder_agreement", "Founder Agreement", "Legal", ["legal_advisor"],
      "Draft a founders' agreement.\n\n"
      "Company: {company} | Founders: {founders}\n"
      "Cover: roles and responsibilities, equity split and vesting (4-year, "
      "1-year cliff recommended), IP assignment, decision-making, non-compete, "
      "dispute resolution and dissolution.",
      "Founders' agreement with vesting and IP clauses.",
      [_f("company", "Company", "text", True, "e.g. Atlas Ltd"),
       _f("founders", "Founders", "text", False, "e.g. A (CEO) 45%, B (CTO) 35%, C (CMO) 20%")],
      "Scale"),
    t("cofounder_agreement", "Co-Founder Agreement", "Legal", ["legal_advisor"],
      "Draft a co-founder agreement.\n\n"
      "Company: {company} | Co-founders: {cofounders}\n"
      "Include: equity and vesting, roles, IP assignment to the company, "
      "confidentiality, non-solicit, conflict resolution, buy-sell / leaving "
      "provisions, and what happens on departure.",
      "Co-founder agreement with vesting and exit terms.",
      [_f("company", "Company", "text", True, "e.g. FinTrack Inc"),
       _f("cofounders", "Co-founders & split", "text", False, "e.g. X 50%, Y 50%")],
      "Users"),
    t("employment_contract", "Employment Contract", "Legal", ["legal_advisor"],
      "Draft an employment contract.\n\n"
      "Company: {company} | Role: {role} | Jurisdiction: {jurisdiction}\n"
      "Include: duties, compensation, benefits, working hours, probation, "
      "termination, notice, confidentiality, IP assignment, non-compete and "
      "governing law.",
      "Employment contract with IP and termination clauses.",
      [_f("company", "Company", "text", True, "e.g. CloudX"),
       _f("role", "Role", "text", True, "e.g. Senior Backend Engineer"),
       _f("jurisdiction", "Jurisdiction", "text", False, "e.g. UK")],
      "Briefcase"),
    t("privacy_policy", "Privacy Policy", "Legal", ["legal_advisor"],
      "Draft a privacy policy.\n\n"
      "Company: {company} | Data practices: {data_practices} | Jurisdiction: {jurisdiction}\n"
      "Cover: data collected, lawful basis, use, sharing, retention, user rights, "
      "cookies, security, international transfers, children, and contact. Align "
      "with GDPR/CCPA style obligations and flag compliance gaps.",
      "Privacy policy aligned to GDPR/CCPA style obligations.",
      [_f("company", "Company", "text", True, "e.g. Shoply"),
       _f("data_practices", "Data practices", "textarea", False, "What data you collect and why"),
       _f("jurisdiction", "Jurisdiction", "text", False, "e.g. EU + US")],
      "Shield"),
    t("terms", "Terms & Conditions", "Legal", ["legal_advisor"],
      "Draft Terms & Conditions.\n\n"
      "Company: {company} | Service: {service}\n"
      "Cover: acceptance, eligibility, account rules, payments, IP, acceptable use, "
      "disclaimers, liability limits, termination, dispute resolution, governing "
      "law, and changes to terms.",
      "T&C with liability and dispute clauses.",
      [_f("company", "Company", "text", True, "e.g. Nova"),
       _f("service", "Service described", "textarea", False, "What the service does")],
      "FileText"),
    t("investment_agreement", "Investment Agreement", "Legal", ["legal_advisor"],
      "Draft an investment (SAFE-style) agreement.\n\n"
      "Company: {company} | Investor: {investor} | Amount: {amount}\n"
      "Cover: investment amount, valuation cap / discount, conversion triggers, "
      "MFN rights, pro-rata, no preferential rights, governing law and signatures.",
      "SAFE-style investment agreement with conversion terms.",
      [_f("company", "Company", "text", True, "e.g. Bloom"),
       _f("investor", "Investor", "text", True, "e.g. Angel Fund"),
       _f("amount", "Amount ($)", "number", False, "e.g. 50000")],
      "TrendingUp"),
    t("shareholder_agreement", "Shareholder Agreement", "Legal", ["legal_advisor"],
      "Draft a shareholder agreement.\n\n"
      "Company: {company} | Parties: {parties}\n"
      "Cover: shareholding, board, reserved matters, share transfers, right of "
      "first refusal, tag-along/drag-along, dividends, anti-dilution, exit and "
      "dispute resolution.",
      "Shareholder agreement with transfer and exit rights.",
      [_f("company", "Company", "text", True, "e.g. Core"),
       _f("parties", "Parties", "text", False, "e.g. Founder 55%, VC 30%, ESOP 15%")],
      "Scale"),
    t("legal_checklist", "Legal Checklist", "Legal", ["legal_advisor"],
      "Build a legal checklist for a company at: {stage}.\n\n"
      "Company: {company} | Jurisdiction: {jurisdiction}\n"
      "Cover: incorporation, registrations, IP protection, contracts, employment, "
      "data/privacy, fundraising, tax and compliance. Mark what should be done "
      "now vs before fundraising.",
      "Stage-based legal checklist with priorities.",
      [_f("company", "Company", "text", True, "e.g. Alpha"),
       _f("stage", "Stage", "select", False, "", ["idea", "pre-seed", "seed", "series-a", "series-b"]),
       _f("jurisdiction", "Jurisdiction", "text", False, "e.g. India")],
      "ClipboardCheck"),
]


# ---------------------------------------------------------------------------
# BUSINESS ANALYST AI STUDIO (8)
# ---------------------------------------------------------------------------
ANALYST = [
    t("revenue_analysis", "Revenue Analysis", "Analysis", ["business_analyst"],
      "Analyze revenue performance:\n\n{data_desc}\n\n"
      "Identify revenue mix, growth rates, seasonality, unit economics, and "
      "anomalies. Recommend 3 actions to improve revenue quality.",
      "Revenue deep-dive with growth and anomaly insights.", F_DATA, "LineChart"),
    t("growth_analysis", "Growth Analysis", "Analysis", ["business_analyst"],
      "Analyze growth:\n\n{data_desc}\n\n"
      "Break down growth into acquisition, activation, retention and expansion. "
      "Identify the growth levers with the highest impact and an experiment plan.",
      "AARRR-style growth breakdown with levers.", F_DATA, "TrendingUp"),
    t("customer_analytics", "Customer Analytics", "Analysis", ["business_analyst"],
      "Analyze customer behavior:\n\n{data_desc}\n\n"
      "Segment customers, identify behavioral patterns, understand churn drivers "
      "and lifetime value, and recommend retention improvements.",
      "Customer segmentation and churn/LTV insights.", F_DATA, "Users"),
    t("forecasting", "Forecasting", "Analysis", ["business_analyst"],
      "Build a forecast:\n\n{data_desc}\n\n"
      "Horizon: {horizon}\n"
      "Choose an appropriate method, project the metric with confidence ranges, "
      "state assumptions, and list what would break the forecast.",
      "Forecast with ranges, assumptions and risk factors.",
      F_DATA + [_f("horizon", "Horizon", "text", False, "e.g. next 6 months")], "TrendingUp"),
    t("kpi_dashboard", "KPI Dashboard", "Analysis", ["business_analyst"],
      "Design a KPI dashboard:\n\n{data_desc}\n\n"
      "Focus: {focus}\n"
      "Recommend the KPI set, the single north-star metric, chart types, targets, "
      "alert thresholds and a weekly review cadence.",
      "KPI set with north-star metric and targets.",
      F_DATA + [_f("focus", "Focus", "text", False, "e.g. subscription growth")], "LayoutDashboard"),
    t("churn_prediction", "Churn Prediction", "Analysis", ["business_analyst"],
      "Build a churn analysis plan:\n\n{data_desc}\n\n"
      "Identify leading churn indicators, which segments are at risk, how to "
      "predict churn, and a retention playbook with expected impact.",
      "Churn indicators, risk segments and retention playbook.", F_DATA, "Percent"),
    t("cohort_analysis", "Cohort Analysis", "Analysis", ["business_analyst"],
      "Plan a cohort analysis:\n\n{data_desc}\n\n"
      "Define cohorts, retention curves to build, what patterns to look for, and "
      "the decisions the cohorts should drive.",
      "Cohort definition and retention analysis plan.", F_DATA, "Grid3x3"),
    t("business_insights", "Business Insights", "Analysis", ["business_analyst"],
      "Extract actionable business insights:\n\n{data_desc}\n\n"
      "Summarize the top opportunities, threats, and decisions leadership should "
      "make next, each with supporting data logic.",
      "Priority-ordered insights for leadership.", F_DATA, "Lightbulb"),
]


# ---------------------------------------------------------------------------
# MENTOR AI STUDIO (6)
# ---------------------------------------------------------------------------
MENTOR = [
    t("startup_feedback", "Startup Feedback", "Mentoring", ["mentor"],
      "Give honest, constructive feedback on this startup:\n\n{idea}\n\n"
      "Praise what is strong, then be direct about the biggest gaps in problem "
      "fit, market, and execution, and the single highest-leverage next step.",
      "Direct feedback with one high-leverage next step.", F_IDEA, "MessageSquare"),
    t("product_review", "Product Review", "Mentoring", ["mentor"],
      "Review this product:\n\n{product_desc}\n\n"
      "Assess UX, feature set, differentiation and market fit. Recommend the 2-3 "
      "changes that would most improve adoption.",
      "Product assessment with highest-impact changes.",
      [_f("product_desc", "Product description", "textarea", True, "Describe the product and its users")],
      "Package"),
    t("business_advice", "Business Advice", "Mentoring", ["mentor"],
      "As a seasoned startup mentor, answer:\n\n{question}\n\n"
      "Give practical advice, trade-offs to consider, and a clear recommended action.",
      "Practical advice with trade-offs and action.", [
        _f("question", "Your question", "textarea", True, "e.g. How do we find our first 10 customers?")
      ], "Lightbulb"),
    t("growth_plan", "Growth Plan", "Mentoring", ["mentor"],
      "Build a growth plan for:\n\n{startup_desc}\n\n"
      "Recommend a 90-day focus, the one metric to prioritize, experiments to run, "
      "and the common founder mistakes to avoid.",
      "90-day growth focus with experiments and pitfalls.",
      [_f("startup_desc", "Startup description", "textarea", True, "Describe the startup and current traction")],
      "TrendingUp"),
    t("market_advice", "Market Advice", "Mentoring", ["mentor"],
      "Advise on market strategy for:\n\n{startup_desc}\n\n"
      "Market: {market}\n"
      "Assess market timing, positioning, pricing, and competitive entry strategy. "
      "Recommend where to start and where to avoid.",
      "Market positioning and entry advice.",
      [_f("startup_desc", "Startup description", "textarea", True, "Describe the startup"),
       _f("market", "Target market", "text", False, "e.g. logistics in Africa")],
      "Globe"),
    t("founder_coaching", "Founder Coaching", "Mentoring", ["mentor"],
      "Coach a founder facing:\n\n{situation}\n\n"
      "Help them clarify the real problem, options, trade-offs, and a concrete "
      "decision. Be supportive but direct.",
      "Coaching session with clear decision framework.",
      [_f("situation", "Situation / dilemma", "textarea", True, "e.g. Should I stay solo or find a co-founder?")],
      "Users"),
]


# ---------------------------------------------------------------------------
# RECRUITER AI STUDIO (6)
# ---------------------------------------------------------------------------
RECRUITER = [
    t("job_description", "Generate Job Description", "Hiring", ["recruiter"],
      "Write an inclusive job description for: {role}\n\n"
      "Company: {company} | Key skills: {skills}\n"
      "Include: role summary, responsibilities, requirements (must-have / "
      "nice-to-have), salary range guidance, benefits, and a compelling 'why us'.",
      "Inclusive job description with requirements and benefits.",
      [_f("role", "Role", "text", True, "e.g. Product Designer"),
       _f("company", "Company", "text", False, "e.g. Atlas"),
       _f("skills", "Key skills", "text", False, "e.g. Figma, prototyping, design systems")],
      "Briefcase"),
    t("candidate_ranking", "Candidate Ranking", "Hiring", ["recruiter"],
      "Rank these candidates for: {role}\n\n"
      "Candidates:\n{candidates}\n\n"
      "Score each against the role (0-100), list strengths and gaps, and rank "
      "them with a recommendation on who to interview first.",
      "Ranked candidates with scores and interview order.",
      [_f("role", "Role", "text", True, "e.g. Growth Marketer"),
       _f("candidates", "Candidates", "textarea", True, "One candidate per line: name + experience + skills")],
      "BarChart3"),
    t("resume_analysis", "Resume Analysis", "Hiring", ["recruiter"],
      "Analyze this resume for a recruiter:\n\n{resume}\n\n"
      "Summarize fit, standout strengths, red flags/gaps, questions to ask in "
      "interview, and whether to advance the candidate.",
      "Fit summary with strengths, gaps and interview questions.",
      [_f("resume", "Resume / profile", "textarea", True, "Paste the resume or profile")], "FileText"),
    t("interview_questions", "Interview Questions", "Hiring", ["recruiter"],
      "Write interview questions for: {role}\n\n"
      "Key skills: {skills}\n"
      "Provide: 5 behavioral (STAR) questions, 5 role-specific technical "
      "questions, and 3 'red flag' screening questions with ideal vs warning "
      "responses.",
      "Behavioral + technical + screening questions.",
      [_f("role", "Role", "text", True, "e.g. Frontend Engineer"),
       _f("skills", "Key skills", "text", False, "e.g. React, TypeScript, testing")],
      "MessageSquare"),
    t("skill_gap", "Skill Gap Analysis", "Hiring", ["recruiter"],
      "Analyze the skill gaps for: {role}\n\n"
      "Candidates:\n{candidates}\n\n"
      "Compare required vs demonstrated skills, identify the biggest gaps, and "
      "recommend training or adjustment of the requirements.",
      "Skill gap matrix with recommendations.",
      [_f("role", "Role", "text", True, "e.g. Data Scientist"),
       _f("candidates", "Candidates", "textarea", True, "Name + skills demonstrated")],
      "Gauge"),
    t("hiring_report", "Hiring Report", "Hiring", ["recruiter"],
      "Produce a hiring pipeline report for: {role}\n\n"
      "Candidates:\n{candidates}\n\n"
      "Summarize pipeline health, time-to-fill, pass rates, top candidates, and "
      "recommended next actions.",
      "Pipeline health report with next actions.",
      [_f("role", "Role", "text", True, "e.g. Backend Engineer"),
       _f("candidates", "Candidates", "textarea", False, "Candidates and their stage")],
      "ClipboardList"),
]


# ---------------------------------------------------------------------------
# COMMON AI TOOLS (7) — available to every role
# ---------------------------------------------------------------------------
COMMON_TOOLS = [
    t("ai_chat", "AI Chat", "Common", COMMON,
      "You are a helpful startup assistant. Answer: {question}\n"
      "Be specific, concise and practical.",
      "General-purpose AI assistant.", [
        _f("question", "Your question", "textarea", True, "Ask anything")
      ], "MessageCircle"),
    t("meeting_summary", "Meeting Summary", "Common", COMMON,
      "Summarize this meeting transcript into: key decisions, action items with "
      "owners, open questions, and a one-line summary.\n\n{transcript}",
      "Meeting summary with decisions and action items.", [
        _f("transcript", "Transcript", "textarea", True, "Paste the meeting transcript")
      ], "ClipboardCheck"),
    t("translate", "Translate", "Common", COMMON,
      "Translate the following text into {target_lang}, preserving tone and "
      "meaning. Provide the translation, then a back-translation check.\n\n{text}",
      "Translate text with a back-translation check.", [
        _f("text", "Text to translate", "textarea", True, "Text to translate"),
        _f("target_lang", "Target language", "text", False, "e.g. Spanish, Swahili")
      ], "Languages"),
    t("document_summarizer", "Document Summarizer", "Common", COMMON,
      "Summarize this document: main points, key numbers, decisions, and "
      "actionable takeaways. Keep it under 250 words.\n\n{document}",
      "Concise document summary with key numbers.", [
        _f("document", "Document", "textarea", True, "Paste the document text")
      ], "FileText"),
    t("voice_assistant", "Voice Assistant", "Common", COMMON,
      "Answer the following spoken-style query conversationally, as if replying "
      "by voice: {query}",
      "Conversational voice-style assistant.", [
        _f("query", "Your query", "textarea", True, "e.g. What should I focus on this week?")
      ], "Mic"),
    t("search", "Search", "Common", COMMON,
      "Act as an analyst. Based on this search query, provide a structured "
      "research answer with key findings, sources to check, and follow-up "
      "questions: {query}",
      "Structured research-style answer.", [
        _f("query", "Search query", "textarea", True, "e.g. state of AI fundraising in Africa")
      ], "Search"),
    t("notifications", "Notifications", "Common", COMMON,
      "Draft a short, friendly notification or announcement for: {message}\n"
      "Provide a punchy headline (under 60 chars) and a 1-2 sentence body.",
      "Notification and announcement drafts.", [
        _f("message", "What to announce", "textarea", True, "e.g. New feature launch")
      ], "Bell"),
]


# ---------------------------------------------------------------------------
# Aggregated catalog
# ---------------------------------------------------------------------------
def _all_tools() -> list[AITool]:
    groups = [
        FOUNDER, DEVELOPER, DESIGNER, MARKETER, INVESTOR,
        LEGAL, ANALYST, MENTOR, RECRUITER, COMMON_TOOLS,
    ]
    tools: dict[str, AITool] = {}
    for group in groups:
        for tool in group:
            tools[tool.slug] = tool
    return list(tools.values())


TOOLS: list[AITool] = _all_tools()

TOOL_BY_SLUG: dict[str, AITool] = {tool.slug: tool for tool in TOOLS}

CATEGORY_ORDER = [
    "Strategy", "Finance", "Fundraising", "Market", "Analytics", "Team", "Brand",
    "Advice", "Exports", "Code", "Docs", "DevOps", "Design", "Content", "Ads",
    "SEO", "Analysis", "Legal", "Mentoring", "Hiring", "Common", "General",
]

# Role -> studio label (used by the frontend).
ROLE_STUDIO_LABELS: dict[str, str] = {
    "founder": "Founder AI Studio",
    "developer": "Developer AI Studio",
    "designer": "Designer AI Studio",
    "marketer": "Marketer AI Studio",
    "investor": "Investor AI Studio",
    "legal_advisor": "Legal AI Studio",
    "business_analyst": "Business Analyst AI Studio",
    "mentor": "Mentor AI Studio",
    "recruiter": "Recruiter AI Studio",
    "administrator": "Administrator AI Studio",
}


def tools_for_roles(roles: list[str]) -> list[AITool]:
    """Return catalog tools a user may see (role match or common)."""
    role_set = set(roles)
    return [
        tool
        for tool in TOOLS
        if "common" in tool.roles or any(r in role_set for r in tool.roles)
    ]
