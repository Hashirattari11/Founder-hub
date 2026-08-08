# FounderHub AI - Deployment Guide

FounderHub deploys as a **single Vercel project**: the FastAPI backend serves both the `/api/*` endpoints and the built frontend (React SPA) from the same deployment. Database lives on Supabase.

---

## Architecture (one deployment)

- **Vercel root directory:** repository root (leave it empty / `.`)
- **Entrypoint:** `main.py` at the repo root - the ASGI app. It imports the FastAPI app from `backend/app/main.py`, mounts `frontend/dist` assets, and falls back to `index.html` for client-side routes.
- **Python runtime is forced via legacy `builds`** in `vercel.json` (`@vercel/python` on `main.py`). This is deliberate: Vercel's zero-config framework detection only runs on a project's *first* deployment, so on an existing project it silently falls back to static hosting (all routes 404). The legacy `builds` config bypasses detection entirely and always invokes the Python builder.
- **Build:** the `buildCommand` in `vercel.json`'s `builds[].config` runs `cd frontend && npm ci && npm run build && rm -rf node_modules`, so the built SPA is bundled into the Python function (`node_modules` is removed to stay under the function size limit).
- **Routes:** `vercel.json` `routes` sends every path (`/(.*)`) to `main.py`; the backend handles `/api/*`, serves bundled assets, and falls back to `index.html` for client-side routes.
- **Do not remove** `builds`/`routes` from `vercel.json`, and keep `frontend/dist` OUT of `.vercelignore` (a `**/dist` rule there strips the SPA from the function bundle).
- **Env:** Vite build vars come from `frontend/.env.production` (publishable Supabase values, committed). Backend secrets are NOT committed - set them in Vercel's Environment Variables (below).
- **API URL:** the frontend calls the same origin in production (`VITE_API_URL` empty -> `window.location.origin`), so `/api/*` requests hit the backend function. Local dev still uses `http://localhost:8001`.

---

## 1. Database (Supabase) - do this first

Run these SQL scripts in **Supabase Dashboard > SQL Editor**, in order:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/create_profiles.sql` | `profiles` table, RLS, signup trigger |
| 2 | `supabase/migrations/phase1_schema.sql` | `startups`, `applications`, `messages`, `notifications`, `saved_startups` + RLS |
| 3 | `supabase/migrations/seed_data.sql` | sample startups/profiles/applications |

Auth configuration:
- **Site URL:** `https://<your-app>.vercel.app`
- **Redirect URLs:** `https://<your-app>.vercel.app/**`
- **Google provider:** add callback `https://<project>.supabase.co/auth/v1/callback`

---

## 2. Deploy to Vercel (everything)

1. Push the repo to GitHub.
2. [vercel.com](https://vercel.com) > **Add New > Project** > import `founderhub`.
3. **Root directory:** leave at repository root (`.`).
4. Framework preset: **Python** (the `builds` config in `vercel.json` forces `@vercel/python` regardless). **Do not** set root directory to `frontend` - that only deploys the SPA and skips the backend.
5. Click **Deploy**.

### Environment variables (Project Settings > Environment Variables)

Set these for all environments. Copy values from your local `backend/.env` and Supabase dashboard.

| Name | Required | Value |
|------|----------|-------|
| `SUPABASE_URL` | yes | `https://gpodjlgfjnmhefwchoix.supabase.co` |
| `SUPABASE_ANON_KEY` | yes | your anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (cross-user/admin) | service_role key (keep secret) |
| `SUPER_ADMIN_EMAIL` | yes | super admin email (bootstrap) |
| `SUPER_ADMIN_PASSWORD` | yes | super admin password (keep secret) |
| `BREVO_API_KEY` | yes (email) | Brevo transactional email API key (keep secret) |
| `BREVO_WEBHOOK_SECRET` | optional (webhook) | Brevo webhook signing secret for delivery events |
| `ANTHROPIC_API_KEY` | yes (AI) | Anthropic key for AI features |
| `ENCRYPTION_KEY` | yes | your encryption key |
| `FRONTEND_URL` | yes | `https://<your-app>.vercel.app` |
| `ALLOWED_ORIGINS` | optional | `http://localhost:5173,https://<your-app>.vercel.app` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | if Google login | your OAuth creds |

> Vite build vars (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) come from the committed `frontend/.env.production` and don't need to be set again.

### Redeploy after changing env vars

After saving env vars, trigger **Redeploy** (they only apply to new deployments).

---

## 3. Verify

- `https://<your-app>.vercel.app/health` -> `{"status":"ok"}`
- `https://<your-app>.vercel.app/api/startups` -> JSON array
- `https://<your-app>.vercel.app/` -> the app loads (no black screen)
- Open `/admin/dashboard` -> admin console works

### Troubleshooting

- **Black screen:** the Vite build was missing `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`. They are now in `frontend/.env.production` - redeploy.
- **404 on refresh / deep links:** fixed by the SPA fallback in `main.py` - no extra `rewrites` needed (the `routes` entry sends everything to the function).
- **Every route returns 404 (static-only deploy):** the project fell back to static hosting because zero-config framework detection didn't run. Make sure `vercel.json` still has the `builds` + `routes` config and redeploy.
- **SPA loads but assets 404:** `frontend/dist` was excluded from the function bundle - check `.vercelignore` has no `**/dist` rule.
- **API errors at runtime:** most likely a missing backend env var - check Vercel function logs.
- **Background jobs** (reminder/push loops) run on the live backend process; on Vercel they only run while a function instance is warm. For guaranteed scheduled jobs, use Supabase scheduled functions or a cron hitting `/health`.

---

## Local development (unchanged)

- Frontend: `cd frontend && npm run dev` (port 5173)
- Backend: `start_backend.bat` (uvicorn `app.main:app` on port 8001, reads `backend/.env`)
- The unified entrypoint can be tested locally too:

```bash
cd frontend && npm run build
cd .. && .venv\Scripts\python -m uvicorn main:app --port 8020
# open http://localhost:8020
```
