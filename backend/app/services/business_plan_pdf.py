"""PDF export for AI business plans (dependency-free, via pdf_writer)."""
from __future__ import annotations

from datetime import datetime, timezone

from app.services.pdf_writer import PAGE_W, PdfWriter

MARGIN = 36.0
CONTENT_W = PAGE_W - 2 * MARGIN
MAX_Y = 800
NEW_PAGE_Y = 60


def _money(n) -> str:
    if n is None:
        return "—"
    try:
        return f"${int(n):,}"
    except (TypeError, ValueError):
        return str(n)


def _plan_name(plan: dict) -> str:
    return plan.get("startup_name") or (plan.get("inputs") or {}).get("startup_name") or "Business Plan"


def _plan_idea(plan: dict) -> str:
    return plan.get("idea") or (plan.get("inputs") or {}).get("idea") or ""


def _wrap(text: str, size: float) -> list[str]:
    """Word-wrap a single paragraph into lines of roughly `size`-point text."""
    max_chars = max(10, int(CONTENT_W / (size * 0.50)))
    words = text.replace("\u2014", "— ").split()
    if not words:
        return [""]
    lines: list[str] = []
    current = ""
    for word in words:
        if len(word) > max_chars:
            if current:
                lines.append(current)
                current = ""
            while len(word) > max_chars:
                lines.append(word[:max_chars])
                word = word[max_chars:]
            current = word
        elif not current:
            current = word
        elif len(current) + 1 + len(word) <= max_chars:
            current = f"{current} {word}"
        else:
            lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


class _Canvas:
    def __init__(self, startup_name: str) -> None:
        self.w = PdfWriter()
        self.page_no = 1
        self.y = 40.0
        self.startup_name = startup_name

    def _footer(self) -> None:
        self.w.line(MARGIN, 812, PAGE_W - MARGIN, 812)
        self.w.set_font("Helvetica", 8)
        self.w.set_text_color(0.45, 0.45, 0.45)
        self.w.text(MARGIN, 819, f"FounderHub — {self.startup_name}")
        self.w.text(PAGE_W - MARGIN - 40, 819, f"Page {self.page_no}")

    def new_page(self) -> None:
        self.w.new_page()
        self.page_no += 1
        self._footer()
        self.y = NEW_PAGE_Y

    def ensure(self, space: float) -> None:
        if self.y + space > MAX_Y:
            self.new_page()

    def line(self, x: float, y: float, text: str, size: float = 9.5,
             color=(0.15, 0.15, 0.15), bold: bool = False) -> None:
        self.w.set_font("Helvetica-Bold" if bold else "Helvetica", size)
        self.w.set_text_color(*color)
        self.w.text(x, y, text)

    def wrap_paragraph(self, text: str, size: float = 9.5, indent: float = 0.0,
                       gap: float = 3.4, color=(0.15, 0.15, 0.15), bold: bool = False) -> None:
        for line in _wrap(text, size):
            self.ensure(size + gap)
            self.line(MARGIN + indent, self.y, line, size=size, color=color, bold=bold)
            self.y += size + gap

    def section(self, title: str, body: str) -> None:
        self.ensure(22)
        self.y += 6
        self.w.set_stroke_color(0.78, 0.78, 0.85)
        self.w.line(MARGIN, self.y - 3, PAGE_W - MARGIN, self.y - 3)
        self.line(MARGIN, self.y, title, size=12, color=(0.1, 0.1, 0.14), bold=True)
        self.y += 15

        blocks = str(body).split("\n\n")
        for block in blocks:
            lines = block.split("\n")
            if all(l.lstrip().startswith("-") for l in lines if l.strip()):
                for line in lines:
                    if not line.strip():
                        continue
                    clean = line.lstrip().lstrip("- ").strip()
                    self.w.set_font("Helvetica", 9.5)
                    for wrapped in _wrap(clean, 9.5):
                        self.ensure(12.9)
                        self.w.set_text_color(0.15, 0.15, 0.15)
                        self.w.text(MARGIN + 14, self.y, f"\u2022  {wrapped}")
                        self.y += 12.9
            else:
                for line in lines:
                    if line.strip():
                        self.wrap_paragraph(line, gap=3.4)
                self.y += 3.0
        self.y += 4


def _render_cover(c: _Canvas, plan: dict) -> None:
    inputs = plan.get("inputs") or {}
    c.w.set_text_color(0.10, 0.10, 0.14)
    c.w.set_font("Helvetica-Bold", 26)
    name = _plan_name(plan)
    wrapped = _wrap(name, 26)
    for i, line in enumerate(wrapped[:2]):
        c.w.text(MARGIN, 170 + i * 32, line)

    c.w.set_font("Helvetica", 12)
    c.w.set_text_color(0.35, 0.35, 0.4)
    idea = _plan_idea(plan)
    for i, line in enumerate(_wrap(idea, 12)[:3]):
        c.w.text(MARGIN, 246 + i * 17, line)

    c.w.set_stroke_color(0.85, 0.85, 0.9)
    c.w.line(MARGIN, 310, PAGE_W - MARGIN, 310)

    rows = [
        ("Industry", inputs.get("industry") or "—"),
        ("Country", inputs.get("country") or "—"),
        ("Stage", inputs.get("stage") or "—"),
        ("Business model", inputs.get("business_model") or "—"),
        ("Team size", str(inputs.get("team_size") or 1)),
        ("Funding goal", _money(inputs.get("funding_goal"))),
        ("Monthly budget", _money(inputs.get("budget"))),
    ]
    c.w.set_font("Helvetica", 10)
    y = 330
    for label, value in rows:
        c.w.set_text_color(0.5, 0.5, 0.55)
        c.w.text(MARGIN, y, label.upper())
        c.w.set_text_color(0.1, 0.1, 0.14)
        c.w.text(MARGIN + 150, y, value)
        y += 22

    readiness = plan.get("investor_readiness") or {}
    c.w.set_text_color(0.5, 0.5, 0.55)
    c.w.text(MARGIN, y + 4, "INVESTOR READINESS")
    c.w.set_font("Helvetica-Bold", 22)
    c.w.set_text_color(0.10, 0.10, 0.14)
    c.w.text(MARGIN + 150, y + 4, f"{readiness.get('overall', 0)}/100  ·  {readiness.get('label') or ''}")

    generated = datetime.now(timezone.utc).strftime("%B %d, %Y")
    c.w.set_font("Helvetica", 9)
    c.w.set_text_color(0.45, 0.45, 0.45)
    c.w.text(MARGIN, 812, f"Generated {generated}")


def _render_sections(c: _Canvas, plan: dict) -> None:
    for section in plan.get("business_plan") or []:
        c.section(section.get("title") or section.get("key") or "", section.get("content") or "")


def _render_pitch_deck(c: _Canvas, plan: dict) -> None:
    c.new_page()
    c.line(MARGIN, c.y, "Pitch Deck", size=16, color=(0.1, 0.1, 0.14), bold=True)
    c.y += 20
    for slide in plan.get("pitch_deck") or []:
        c.ensure(26)
        c.y += 4
        c.line(MARGIN, c.y, slide.get("title") or "", size=12, color=(0.1, 0.1, 0.14), bold=True)
        c.y += 14
        for b in slide.get("bullets") or []:
            for wrapped in _wrap(b, 9.5):
                c.ensure(12.9)
                c.line(MARGIN + 12, c.y, f"\u2022  {wrapped}", size=9.5)
                c.y += 12.9
        note = slide.get("note")
        if note:
            c.ensure(12)
            for wrapped in _wrap(note, 8.5):
                c.ensure(11.9)
                c.line(MARGIN + 12, c.y, wrapped, size=8.5, color=(0.45, 0.45, 0.5))
                c.y += 11.9
        c.y += 6


def _render_financials(c: _Canvas, plan: dict) -> None:
    c.new_page()
    c.line(MARGIN, c.y, "Financial Projection", size=16, color=(0.1, 0.1, 0.14), bold=True)
    c.y += 8
    fin = plan.get("financial_projection") or {}

    stat_rows = [
        ("Year-1 revenue", _money(fin.get("year1_revenue"))),
        ("Year-3 revenue", _money(fin.get("year3_revenue"))),
        ("Monthly burn", _money(fin.get("monthly_budget"))),
        ("Burn rate", _money(fin.get("burn_rate")) + "/mo"),
        ("Break-even", f"Month {fin['break_even_month']}" if fin.get("break_even_month") else "Beyond 12 months"),
        ("Runway", f"{fin['runway_months']} months" if fin.get("runway_months") else "—"),
    ]
    c.w.set_font("Helvetica", 10)
    y = c.y
    for label, value in stat_rows:
        c.w.set_text_color(0.5, 0.5, 0.55)
        c.w.text(MARGIN, y, label.upper())
        c.w.set_text_color(0.1, 0.1, 0.14)
        c.w.text(MARGIN + 150, y, value)
        y += 19
    c.y = y + 6

    c.line(MARGIN, c.y, "Expense breakdown (monthly)", size=12, color=(0.1, 0.1, 0.14), bold=True)
    c.y += 15
    for k, label in (("salaries", "Salaries"), ("marketing", "Marketing"), ("infrastructure_tools", "Infrastructure & tools"),
                     ("operations", "Operations"), ("other", "Other"), ("total", "Total monthly budget")):
        c.ensure(14)
        c.w.set_font("Helvetica" if k != "total" else "Helvetica-Bold", 10)
        c.w.set_text_color(0.15, 0.15, 0.15)
        c.w.text(MARGIN, c.y, label)
        c.w.text(MARGIN + 200, c.y, _money(fin.get("expense_breakdown", {}).get(k)))
        c.y += 14

    c.y += 6
    c.line(MARGIN, c.y, "12-month forecast", size=12, color=(0.1, 0.1, 0.14), bold=True)
    c.y += 10

    headers = ["Month", "Revenue", "Expenses", "Cash flow", "Cumulative"]
    col_w = [56, 117, 117, 117, 117]
    revenue = fin.get("monthly_revenue") or []
    expenses = fin.get("monthly_expenses") or []
    cash_flow = fin.get("monthly_cash_flow") or []
    cumulative = fin.get("cumulative_cash") or []
    n = max(1, len(revenue))

    def header_row() -> None:
        c.w.set_fill_color(0.9, 0.9, 0.94)
        c.w.rect(MARGIN, c.y, CONTENT_W, 16)
        c.w.set_font("Helvetica-Bold", 8.5)
        c.w.set_text_color(0.2, 0.2, 0.25)
        x = MARGIN
        for i, h in enumerate(headers):
            c.w.text(x + 6, c.y + 5, h)
            x += col_w[i]
        c.y += 16

    header_row()
    for i in range(n):
        if c.y > MAX_Y - 20:
            c.new_page()
            header_row()
        m = i + 1
        row = [
            f"M{m}", _money(revenue[i] if i < len(revenue) else 0),
            _money(expenses[i] if i < len(expenses) else 0),
            _money(cash_flow[i] if i < len(cash_flow) else 0),
            _money(cumulative[i] if i < len(cumulative) else 0),
        ]
        c.w.set_font("Helvetica", 8.5)
        c.w.set_text_color(0.15, 0.15, 0.15)
        x = MARGIN
        for j, cell in enumerate(row):
            c.w.text(x + 6, c.y + 5, cell)
            x += col_w[j]
        c.y += 15


def _render_team(c: _Canvas, plan: dict) -> None:
    c.new_page()
    c.line(MARGIN, c.y, "Team Recommendations", size=16, color=(0.1, 0.1, 0.14), bold=True)
    c.y += 10
    headers = ["Role", "Seniority", "#", "Remote", "Why"]
    col_w = [118, 66, 22, 48, 269]
    c.w.set_fill_color(0.9, 0.9, 0.94)
    c.w.rect(MARGIN, c.y, CONTENT_W, 16)
    c.w.set_font("Helvetica-Bold", 8.5)
    c.w.set_text_color(0.2, 0.2, 0.25)
    x = MARGIN
    for i, h in enumerate(headers):
        c.w.text(x + 5, c.y + 5, h)
        x += col_w[i]
    c.y += 16

    for role in plan.get("team_recommendations") or []:
        reason_lines = _wrap(role.get("reason") or "", 8.5)
        row_h = max(15, len(reason_lines) * 12)
        if c.y + row_h > MAX_Y - 20:
            c.new_page()
            c.w.set_fill_color(0.9, 0.9, 0.94)
            c.w.rect(MARGIN, c.y, CONTENT_W, 16)
            c.w.set_font("Helvetica-Bold", 8.5)
            c.w.set_text_color(0.2, 0.2, 0.25)
            x = MARGIN
            for i, h in enumerate(headers):
                c.w.text(x + 5, c.y + 5, h)
                x += col_w[i]
            c.y += 16
        c.w.set_font("Helvetica", 8.5)
        c.w.set_text_color(0.15, 0.15, 0.15)
        c.w.text(MARGIN + 5, c.y + 5, str(role.get("role") or ""))
        c.w.text(MARGIN + col_w[0] + 5, c.y + 5, str(role.get("seniority") or ""))
        c.w.text(MARGIN + col_w[0] + col_w[1] + 5, c.y + 5, str(role.get("count") or 1))
        c.w.text(MARGIN + col_w[0] + col_w[1] + col_w[2] + 5, c.y + 5,
                 "Yes" if role.get("remote_ok") else "No")
        rx = MARGIN + col_w[0] + col_w[1] + col_w[2] + col_w[3] + 5
        for j, line in enumerate(reason_lines):
            c.w.text(rx, c.y + 5 + j * 12, line)
        c.y += row_h


def _render_recommendations(c: _Canvas, plan: dict) -> None:
    c.new_page()
    c.line(MARGIN, c.y, "AI Recommendations", size=16, color=(0.1, 0.1, 0.14), bold=True)
    c.y += 14
    labels = [
        ("missing_features", "Missing features to add"),
        ("weaknesses", "Current weaknesses"),
        ("improvements", "Improvements to make"),
        ("risks", "Risks to manage"),
        ("scaling_plan", "Scaling plan"),
        ("internationalization", "Internationalization"),
    ]
    recs = plan.get("ai_recommendations") or {}
    for key, title in labels:
        items = recs.get(key) or []
        if not items:
            continue
        c.ensure(22)
        c.line(MARGIN, c.y, title, size=12, color=(0.1, 0.1, 0.14), bold=True)
        c.y += 14
        for item in items:
            for wrapped in _wrap(item, 9.5):
                c.ensure(12.9)
                c.line(MARGIN + 12, c.y, f"\u2022  {wrapped}", size=9.5)
                c.y += 12.9
        c.y += 6


def render_business_plan_pdf(plan: dict) -> bytes:
    c = _Canvas(_plan_name(plan))
    c._footer()
    _render_cover(c, plan)
    _render_sections(c, plan)
    _render_pitch_deck(c, plan)
    _render_financials(c, plan)
    _render_team(c, plan)
    _render_recommendations(c, plan)
    return c.w.build()


def render_business_plan_markdown(plan: dict) -> str:
    out: list[str] = []
    out.append(f"# {_plan_name(plan)}\n")
    idea = _plan_idea(plan)
    if idea:
        out.append(f"> {idea}\n")
    inputs = plan.get("inputs") or {}
    out.append("\n| Field | Value |\n|---|---|")
    for label, key in (("Industry", "industry"), ("Country", "country"), ("Stage", "stage"),
                       ("Business model", "business_model")):
        out.append(f"| {label} | {inputs.get(key) or '—'} |")
    out.append(f"| Team size | {inputs.get('team_size') or 1} |")
    out.append(f"| Funding goal | {_money(inputs.get('funding_goal'))} |")

    readiness = plan.get("investor_readiness") or {}
    out.append(f"\n## Investor Readiness: **{readiness.get('overall', 0)}/100** ({readiness.get('label') or ''})\n")

    for section in plan.get("business_plan") or []:
        out.append(f"\n## {section.get('title') or section.get('key')}\n")
        out.append(section.get("content") or "")

    out.append("\n\n## Pitch Deck\n")
    for slide in plan.get("pitch_deck") or []:
        out.append(f"\n### {slide.get('title')}\n")
        for b in slide.get("bullets") or []:
            out.append(f"- {b}")
        if slide.get("note"):
            out.append(f"\n_{slide['note']}_")

    fin = plan.get("financial_projection") or {}
    out.append("\n\n## Financial Projection\n")
    out.append(f"- Year-1 revenue: {_money(fin.get('year1_revenue'))}")
    out.append(f"- Year-3 revenue: {_money(fin.get('year3_revenue'))}")
    out.append(f"- Monthly burn: {_money(fin.get('monthly_budget'))}")
    out.append(f"- Break-even: {'Month %s' % fin['break_even_month'] if fin.get('break_even_month') else 'Beyond 12 months'}")
    out.append("\n| Month | Revenue | Expenses | Cash flow | Cumulative |\n|---|---|---|---|---|")
    for i in range(len(fin.get("monthly_revenue") or [])):
        out.append(f"| M{i+1} | {_money((fin.get('monthly_revenue') or [0])[i])} | "
                   f"{_money((fin.get('monthly_expenses') or [0])[i])} | "
                   f"{_money((fin.get('monthly_cash_flow') or [0])[i])} | "
                   f"{_money((fin.get('cumulative_cash') or [0])[i])} |")

    out.append("\n\n## Team Recommendations\n")
    for role in plan.get("team_recommendations") or []:
        out.append(f"- **{role.get('role')}** ({role.get('seniority')}, x{role.get('count')}, "
                   f"remote: {'yes' if role.get('remote_ok') else 'no'}) — {role.get('reason')}")

    labels = [("missing_features", "Missing features"), ("weaknesses", "Weaknesses"),
              ("improvements", "Improvements"), ("risks", "Risks"),
              ("scaling_plan", "Scaling plan"), ("internationalization", "Internationalization")]
    recs = plan.get("ai_recommendations") or {}
    out.append("\n\n## AI Recommendations\n")
    for key, title in labels:
        items = recs.get(key) or []
        if not items:
            continue
        out.append(f"\n### {title}\n")
        for item in items:
            out.append(f"- {item}")

    out.append("\n\n---\n_Generated by FounderHub AI Business Plan Generator._")
    return "\n".join(out)
