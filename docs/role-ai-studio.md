# Role-Based AI Studio

Phase 16 module: every platform role gets its own data-driven AI tool studio.
Founders, developers, designers, marketers, investors, legal advisors, business
analysts, mentors, recruiters and administrators each see tools tailored to
their job, driven entirely by a backend catalog plus per-tool database
overrides. Available on web (`/ai-studio`, admin at `/admin/ai-studio`) and
Expo mobile (Profile → "AI Studio").

## Roles and studios

The platform supports 10 roles: `founder`, `developer`, `designer`, `marketer`,
`investor`, `legal_advisor`, `business_analyst`, `mentor`, `recruiter`,
`administrator`. A user has a primary role (`profiles.role`) plus optional
extra roles (`user_roles`), so a single account can own multiple studios.
Multi-role users see merged tool lists and merged dashboard navigation.

## Tool catalog

`backend/app/services/ai_studio_catalog.py` defines 108 built-in tools. Each
tool has a slug, name, description, category, icon, allowed roles, prompt
template, input fields and output format. Built-ins are seeded into `ai_tools`
on first demand and can be toggled/patched by admins; admins can also create
fully custom tools.

## API

Base path `/api/ai-studio` (router in `backend/app/api/ai_studio.py`, guards in
`backend/app/core/rbac.py`).

- `GET /config` — role-aware tool list for the current user.
- `POST /tools/{slug}/run` — validates role + required fields, renders the
  prompt template, runs the user's configured AI provider via
  `backend/app/api/ai.py:generate_text_sync`, logs usage, returns
  `{ tool, title, output, provider, latency_ms }`. Missing keys fall back
  gracefully; the provider badge comes from `_resolve_user_provider`.
- Admin group (admins only, 403 otherwise):
  - `GET/POST /admin/tools`, `PATCH/DELETE /admin/tools/{slug}`
  - `GET /admin/users`, `PUT /admin/users/{user_id}/roles`
  - `GET /admin/usage`, `GET /admin/analytics`

RBAC: a user may only run tools whose roles intersect their own; `common` tools
are available unless explicitly denied per role in `role_permissions`.

## Database

Migration `supabase/migrations/phase16_role_ai_studio.sql`:

- `roles` — role list seeded from the catalog.
- `user_roles` — user ↔ role mappings.
- `ai_tools` — built-in + custom tool overrides (prompt template, fields,
  enabled flag).
- `role_permissions` — per-role tool deny lists.
- `user_preferences` — per-user provider choice (used by AI settings).
- `ai_usage_logs` — every run with provider, status and error.
- `profiles` CHECK constraint expanded to allow the 10 roles.

## Frontend (web)

- `frontend/src/pages/AIStudio.tsx` — studio tabs, category filter, search, tool
  modal with dynamic fields, generation steps, provider badge, copy/download.
- `frontend/src/pages/admin/AIStudioAdmin.tsx` — Tools / Users / Analytics /
  Usage tabs with full tool CRUD and per-user role assignment.
- `frontend/src/lib/aiStudio.ts` — typed API client + cached
  `useAIStudioConfig(userId)` hook used by the studio page and the dashboard
  sidebar for multi-role navigation.
- `frontend/src/lib/studioIcons.tsx` — catalog icon registry with fallback.
- `frontend/src/components/studio/AiMarkdown.tsx` — markdown renderer for tool
  output.

## Frontend (mobile)

- `mobile/app/ai-studio/index.tsx` — catalog list with role badges, search and
  category chips.
- `mobile/app/ai-studio/[slug].tsx` — field form + run + scrollable output.
- `mobile/src/lib/aiStudio.ts` and `mobile/src/types/aiStudio.ts` mirror the
  web client. Admin is out of scope for mobile.

## Rate limiting and safety

Runs are not rate-limited per-tool but every run is recorded in `ai_usage_logs`
and surfaced in `/admin/analytics`. Disabled tools return 403; role-mismatched
tools return 403; missing required inputs return 400. Admin endpoints use the
service client (tables are admin-only under RLS) and `require_admin` checks
`profiles.is_admin` or the `administrator` role.
