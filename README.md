# FounderHub AI

AI-powered platform for startup founders to build, track, and scale their ventures.

## Live URLs

| Service | URL |
|---------|-----|
| Frontend (Vercel) | `https://<your-app>.vercel.app` |
| Backend (Railway) | `https://<your-backend>.up.railway.app` |
| Health check | `https://<your-backend>.up.railway.app/health` |
| Supabase | `https://gpodjlgfjnmhefwchoix.supabase.co` |

> See [DEPLOY.md](DEPLOY.md) for the full deployment guide.

## Tech Stack

- **Frontend**: React 18+ (Vite) + TypeScript + Tailwind CSS v3 + Framer Motion
- **Backend**: FastAPI (Python 3.11) + Uvicorn
- **Database**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (email/password + Google OAuth)

## Getting Started

### 1. Frontend

```bash
cd frontend
npm install
cp .env.example .env.local  # then fill in your values
npm run dev
```

Frontend runs on `http://localhost:5173`

### 2. Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate      # Windows
# source .venv/bin/activate # macOS/Linux
pip install -r requirements.txt
cp .env.example .env        # then fill in your values
python main.py
```

Backend runs on `http://localhost:8001` — verify with `GET /health`.

### 3. Supabase Setup (required for auth)

1. **Create the tables**: Open Supabase Dashboard → SQL Editor and run these in order:
   - [`supabase/migrations/create_profiles.sql`](supabase/migrations/create_profiles.sql)
   - [`supabase/migrations/phase1_schema.sql`](supabase/migrations/phase1_schema.sql)
   - [`supabase/migrations/seed_data.sql`](supabase/migrations/seed_data.sql) (optional sample data)

2. **Auth settings**: Supabase Dashboard → Authentication → URL Configuration
   - Add `http://localhost:5173` to **Site URL**
   - Add `http://localhost:5173/**` to **Redirect URLs**

3. **Email confirmations**: Dashboard → Authentication → Providers → Email
   - Enable **Confirm email** if you want the verify-then-login flow.

4. **Google OAuth**: Dashboard → Authentication → Providers → Google
   - Enable the provider and add your Google OAuth client ID/secret.

5. **Credentials**: Ensure `frontend/.env.local` has your project URL and anon key:

   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```

### Running Both Servers

```bash
# Terminal 1 — Frontend
cd frontend && npm run dev

# Terminal 2 — Backend
cd backend && python main.py
```

## Auth Flow

| Route               | Purpose                                             |
|---------------------|-----------------------------------------------------|
| `/register`         | Sign up with full name, email, password, role       |
| `/login`            | Sign in (email/password or Google)                  |
| `/auth/callback`    | Email verification + OAuth + password reset landing |
| `/complete-profile` | First-time profile setup (protected)                |
| `/forgot-password`  | Send password reset email                           |
| `/reset-password`   | Set a new password (protected)                      |
| `/dashboard`        | Authenticated app shell (protected)                 |

## Project Structure

```
founderhub/
├── frontend/
│   ├── src/
│   │   ├── components/   # UI + shared components
│   │   ├── pages/        # auth/ + app pages
│   │   ├── context/      # AuthContext
│   │   ├── hooks/        # useTheme, useSession
│   │   ├── lib/          # supabase client
│   │   └── types/
│   └── .env.local
├── backend/
│   ├── app/
│   │   ├── api/          # health, profile, startups, applications
│   │   ├── core/         # config, supabase client, auth
│   │   ├── models/
│   │   ├── schemas/
│   │   └── main.py
│   ├── main.py
│   ├── railway.json
│   ├── .env.example
│   └── requirements.txt
├── supabase/migrations/  # SQL run in Supabase dashboard
├── vercel.json
├── DEPLOY.md
├── .gitignore
└── README.md
```

## API Endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | no | Health check |
| GET | `/api/profiles/{username}` | no | Public profile |
| GET | `/api/startups` | no | Published startups (`?industry=&stage=&search=`) |
| GET | `/api/startups/{id}` | no | Startup detail |
| GET | `/api/applications` | yes | My applications |
| GET | `/api/applications/startup/{startup_id}` | yes | Startup's applications (founder) |
| POST | `/api/applications` | yes | Submit application |

> Auth-required endpoints take a Supabase access token: `Authorization: Bearer <jwt>`.
