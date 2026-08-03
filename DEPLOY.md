# FounderHub AI — Deployment Guide

Deploy the FounderHub AI MVP to production: frontend on Vercel, backend on Railway, database on Supabase.

---

## Prerequisites

- A [GitHub](https://github.com) account
- A [Vercel](https://vercel.com) account (frontend)
- A [Railway](https://railway.app) account (backend)
- Your Supabase project: `https://gpodjlgfjnmhefwchoix.supabase.co`

---

## 1. Database (Supabase) — do this first

Run these SQL scripts in **Supabase Dashboard → SQL Editor**, in order:

| Order | File | Purpose |
|-------|------|---------|
| 1 | `supabase/migrations/create_profiles.sql` | `profiles` table, RLS, signup trigger |
| 2 | `supabase/migrations/phase1_schema.sql` | `startups`, `applications`, `messages`, `notifications`, `saved_startups` + RLS |
| 3 | `supabase/migrations/seed_data.sql` | 3 sample startups, 5 profiles, 3 applications |

> Seed data requires the 5 sample users to already exist in `auth.users` (sign them up at `/register` first, then run seed).

### Auth configuration

Supabase Dashboard → Authentication → URL Configuration:

- **Site URL:** `https://<your-app>.vercel.app`
- **Redirect URLs:** `https://<your-app>.vercel.app/**`

Supabase Dashboard → Authentication → Providers:

- **Email:** confirm email enabled (or disable for instant login)
- **Google:** enable with your OAuth Client ID + Secret, add callback `https://gpodjlgfjnmhefwchoix.supabase.co/auth/v1/callback`

### CORS

Supabase Dashboard → Settings → API → add your Vercel URL to **Allowed Origins** (or leave default which allows all).

---

## 2. Push to GitHub

```bash
cd D:\founderhub
git init
git add .
git commit -m "FounderHub AI MVP"
git branch -M main
git remote add origin https://github.com/<you>/founderhub.git
git push -u origin main
```

> Verify `.env.local` and `backend/.env` are gitignored before pushing.

---

## 3. Deploy Frontend (Vercel)

1. Go to [vercel.com](https://vercel.com) → **Add New → Project**
2. Import the `founderhub` repo
3. Settings:
   - **Framework preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
   - **Root directory:** `frontend`
4. Add environment variables (Project Settings → Environment Variables):

   | Name | Value |
   |------|-------|
   | `VITE_SUPABASE_URL` | `https://gpodjlgfjnmhefwchoix.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | `sb_publishable_...` (your publishable key) |
   | `VITE_APP_URL` | `https://<your-app>.vercel.app` |
   | `VITE_API_URL` | Railway URL from step 4 |

5. Deploy.

> `vercel.json` in the repo already rewrites all routes to `index.html` for React Router.

---

## 4. Deploy Backend (Railway)

1. Go to [railway.app](https://railway.app) → **New Project → Deploy from GitHub**
2. Choose the `founderhub` repo
3. **Root directory:** `backend`
4. Railway uses `backend/railway.json` automatically:
   - Build: Nixpacks
   - Start: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Healthcheck: `/health`
5. Add environment variables (Variables tab):

   | Name | Value |
   |------|-------|
   | `SUPABASE_URL` | `https://gpodjlgfjnmhefwchoix.supabase.co` |
   | `SUPABASE_ANON_KEY` | your anon/publishable key |
   | `ALLOWED_ORIGINS` | `http://localhost:5173,https://<your-app>.vercel.app` |

6. Deploy, then grab the **Public URL** (e.g. `https://founderhub-api.up.railway.app`).
7. Verify: open `https://founderhub-api.up.railway.app/health` → `{"status":"ok"}`.

---

## 5. Post-Deploy

1. Update Supabase Auth **Redirect URLs** to include the Vercel domain (if you didn't already).
2. Update Supabase **Allowed Origins / CORS** with the Vercel domain.
3. Set `VITE_API_URL` on Vercel to the Railway URL and redeploy.
4. Test flows on production:
   - Register → email verify → complete profile
   - Login → dashboard
   - `GET /api/startups?industry=logistics`
   - `GET /api/startups/<id>`
   - `GET /api/profiles/<username>`
   - `POST /api/applications` (with `Authorization: Bearer <jwt>`)

---

## 6. Monitoring

- **Vercel Analytics:** Project Settings → Analytics → Enable (free).
- **Supabase:** Settings → Billing/Usage; enable email alerts for database usage.
- **Status check:** a cron (e.g. GitHub Actions or UptimeRobot) hitting `/health` every 5 min:
  ```
  GET https://founderhub-api.up.railway.app/health
  ```

---

## API Endpoints (production)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | no | Health check |
| GET | `/api/profiles/{username}` | no | Public profile |
| GET | `/api/startups` | no | Published startups (`?industry=&stage=&search=`) |
| GET | `/api/startups/{id}` | no | Startup detail |
| GET | `/api/applications` | yes | My applications |
| GET | `/api/applications/startup/{startup_id}` | yes | Startup's applications (founder) |
| POST | `/api/applications` | yes | Submit application |

---

## Rollback / Troubleshooting

- **404 on refresh (Vercel):** ensure `vercel.json` rewrites are present; redeploy.
- **CORS errors:** add the origin to `ALLOWED_ORIGINS` in Railway + redeploy.
- **RLS 403/400:** verify migration files ran in order; check `pg_policies` for the `profiles` table.
- **API unreachable:** check Railway healthcheck passed; confirm `VITE_API_URL` is correct.
