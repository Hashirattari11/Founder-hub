# Project Context — FounderHub AI (D:\founderhub)

## Environment
- Frontend: Vite+React18+TS (D:\founderhub\frontend), Vercel prod https://founder-hub-0.vercel.app
- Backend: FastAPI (D:\founderhub\backend), deployed to Railway (railway.json) — URL UNKNOWN (find via Railway dashboard or git remotes)
- Branch main. This-session commits: e9cd563, 67fc16e (pushed+deployed). Prior-session auth commit b96f62d.
- Tests: Playwright. ⚠️ port 5173 hijacked by FrameForge AI → ALWAYS use BASE_URL=https://founder-hub-0.vercel.app. Runner: C:\Users\AAMASH\AppData\Local\Temp\opencode\run-auth-prod.ps1. Last prod suite: auth+roles 10 passed / 0 failed.

## THIS-SESSION DB FIXES (both applied via Supabase MCP, live)
1. `restore_profiles_write_grants`: GRANT INSERT,UPDATE ON profiles TO authenticated (was revoked → "permission denied for table profiles"). Security: trg_protect_role_columns protects admin/system columns.
2. `fix_protect_role_columns_connections_count_default`: trigger INSERT branch had `connections_count is not null` but column DEFAULT=0 → `0 is not null`=TRUE → RAISE on every user INSERT ("Privileged and system fields are admin-managed"). FIX: changed to `connections_count <> 0` (only non-zero raises). handle_new_user unaffected (runs SECURITY DEFINER, auth.uid() null, guard skipped). VERIFIED fix_applied=true.

## ROOT CAUSE of "Service temporarily unavailable" (separate from auth)
frontend/src/lib/config.ts: `API_URL = VITE_API_URL || (PROD ? '' : 'http://localhost:8001')`.
Vercel env vars (checked via `vercel env ls production`): only VITE_SUPABASE_ANON_KEY + VITE_SUPABASE_URL set. **VITE_API_URL MISSING** → in prod API_URL='' → fetch('/api/...') hits frontend SPA → returns HTML → api.ts parseJson throws "Service temporarily unavailable".
Affects: all FastAPI-backed features (AI generate, war-room insights, AI settings, admin AI summaries). Does NOT affect Register/Login (those use supabase.auth only).
FIX needed: (a) confirm Railway backend is live + get its URL; (b) `npx vercel env add VITE_API_URL production` with the Railway URL; (c) redeploy frontend. UNVERIFIED — don't know Railway URL.

## Auth 18-phase spec (prior session built most — see .opencode/auth-report.md)
PKCE (detectSessionInUrl:false ✓), Callback intent routing ✓, username gen (lib/username.ts) ✓, profile completion gate (lib/profileCompletion.ts + ProfileGateRoute) ✓, role permanence (protect_role_columns + RoleRequestCard + backend emails) ✓, no "temporarily denied" logic ✓, idempotent handle_new_user (ON CONFLICT DO NOTHING) ✓.

## Pending Tasks
- User retest: (1) new account profile save — trigger fix should resolve "Privileged and system fields"; (2) existing account edit save. NO frontend deploy needed for DB fixes.
- Investigate Railway backend URL + set VITE_API_URL on Vercel + redeploy (for "Service temporarily unavailable" on AI/backend features). Ask user if they have the Railway backend URL, OR find via `cd backend; git remote -v` / `railway status`.
- Frontend commits this session (e9cd563, 67fc16e) already deployed. No NEW frontend changes since.
