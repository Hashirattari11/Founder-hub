# AI Business Plan Generator

Phase 15 module: founder enters a startup idea and the system produces a complete,
investor-ready business plan package. Available on web (`/business-plan`) and
Expo mobile (Home → "Business Plan Generator").

## What it generates

- **30-section business plan** — idea, problem, solution, market sizing, competitive
  landscape, GTM, operations, risks, and more, stored as keyed sections.
- **12-slide pitch deck** — each slide has bullets and speaker notes.
- **Financial model** — 12-month revenue / expenses / cash flow / cumulative cash,
  expense breakdown, use-of-funds ratios per stage, break-even month, runway,
  burn rate, and 3-year revenue projections with key assumptions.
- **Team recommendations** — 8 roles (CEO/CTO/CMO/Head of Sales/Head of Product/
  Head of Engineering/Finance/Operations) with seniority, headcount, remote
  eligibility, and rationale.
- **Investor readiness score** — 4 sub-scores (Market, Team, Product, Financials)
  rolled into an overall 0–100 score with a label and summary.
- **AI recommendations** — missing features, weaknesses, improvements, risks,
  scaling plan, and internationalization guidance.

## How generation works

1. The client posts a `GeneratePlanPayload` to `POST /api/business-plan/generate`.
2. The backend calls the multi-provider AI helper
   (`backend/app/api/ai.py:generate_text_sync`). If the user has configured a
   provider key it generates a personalized narrative; otherwise the built-in
   deterministic engine (`backend/app/services/business_plan_generator.py`)
   produces the full plan.
3. AI output is merged only when it parses as valid JSON (`_merge_ai`), so a
   complete plan is always returned. The response `provider` field reports
   `"ai"` or `"offline"`.

## Rate limiting

5 generations per user per hour, tracked in-memory (resets on restart). Exceeded
requests return 429.

## Database

`business_plans` table (migration `supabase/migrations/phase15_business_plans.sql`):

- Owner-only via RLS policy "Owners manage business plans".
- `updated_at` maintained by the `touch_business_plan` trigger.
- `share_token` is a random URL-safe token; a partial unique index enforces
  uniqueness for public rows.

## API

| Method | Endpoint | Auth | Description |
| --- | --- | --- | --- |
| POST | `/api/business-plan/generate` | owner | Generate a new plan |
| GET | `/api/business-plan` | owner | List plan summaries |
| GET | `/api/business-plan/{id}` | owner | Full plan detail |
| PATCH | `/api/business-plan/{id}` | owner | Update name / plan / deck / visibility |
| DELETE | `/api/business-plan/{id}` | owner | Delete a plan |
| GET | `/api/business-plan/share/{token}` | public | Read a shared plan |
| POST | `/api/business-plan/{id}/export` | owner | Export `pdf` / `docx` / `markdown` |

Public share links are served by the backend share-token endpoint (RLS does not
allow anonymous table reads). `is_public` must be true for a share link to be
usable.

Exports:
- PDF reuses `backend/app/services/pdf_writer.py`.
- DOCX is dependency-free OOXML via `backend/app/services/docx_writer.py`.
- Markdown is rendered by `backend/app/services/business_plan_pdf.py`.

## Frontend

- `frontend/src/pages/businessplan/Generator.tsx` — input form with animated
  7-step progress, calls `generateBusinessPlan`.
- `frontend/src/pages/businessplan/Dashboard.tsx` — history, readiness badges,
  delete, share link, "New Plan".
- `frontend/src/pages/businessplan/Viewer.tsx` — 6-tab read/edit view, exports.
- `frontend/src/pages/businessplan/ShareView.tsx` — public read-only view.
- Route order in `App.tsx` registers `/business-plan/share/:token` before
  `/business-plan/:id`.

## Mobile

- `mobile/app/business-plan/index.tsx` — history.
- `mobile/app/business-plan/new.tsx` — generate form.
- `mobile/app/business-plan/[id].tsx` — 5-tab viewer (Overview / Pitch /
  Financials / Team / AI).
- Home screen shows a founder-only entry card.
- Types: `mobile/src/types/businessPlan.ts`; API: `mobile/src/lib/businessPlan.ts`.

## Notes

- supabase-py `.order(col, asc=True)` raises a 500 — use the two-argument form
  (`list_plans` in the API router).
- No provider key configured → generation runs offline by design.
