# FounderHub AI - Deployment Guide

FounderHub deploys as a **single Vercel project**: the FastAPI backend serves both the `/api/*` endpoints and the built frontend (React SPA) from the same deployment. Database lives on Supabase.

---

## Architecture (one deployment)

- **Vercel root directory:** repository root (leave it empty / `.`)
- **Entrypoint:** `main.py` at the repo root - detected by Vercel as the ASGI app. It imports the FastAPI app from `backend/app/main.py`, mounts `frontend/dist` assets, and falls back to `index.html` for client-side routes.
- **Build:** `vercel.json` runs `cd frontend && npm ci && npm run build` first, so the built SPA is bundled into the Python function.
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
4. Framework preset is detected automatically (Python + `vercel.json`). **Do not** set root directory to `frontend` - that only deploys the SPA and skips the backend.
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
| `RESEND_API_KEY` | yes (email) | Resend API key |
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
- **404 on refresh / deep links:** fixed by the SPA fallback in `main.py` - no `vercel.json` rewrites needed.
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
