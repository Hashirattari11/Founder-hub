# Project Context — FounderHub AI (D:\founderhub)

## Environment
- Frontend: Vite+React18+TS (D:\founderhub\frontend), Vercel prod https://founder-hub-0.vercel.app
- Backend: FastAPI (D:\founderhub\backend) — NOT DEPLOYED (only Vercel frontend live). railway.json exists but no live URL.
- Branch main. This-session commits: e9cd563, 67fc16e, 1d917fb (all pushed+deployed).
- Tests: Playwright. ⚠️ port 5173 hijacked by FrameForge AI → ALWAYS use BASE_URL=https://founder-hub-0.vercel.app. Runner: C:\Users\AAMASH\AppData\Local\Temp\opencode\run-auth-prod.ps1.

## THIS-SESSION DB FIXES (via Supabase MCP, live — no deploy needed)
1. `restore_profiles_write_grants`: GRANT INSERT,UPDATE ON profiles TO authenticated (was revoked). trg_protect_role_columns protects admin cols.
2. `fix_protect_role_columns_connections_count_default`: trigger INSERT branch `connections_count is not null` → default 0 → always raised "Privileged and system fields are admin-managed." on user INSERT. Fixed to `<> 0`. handle_new_user unaffected (SECURITY DEFINER).

## THIS-SESSION FRONTEND (deployed)
- e9cd563: Callback intent=register+onboarded→/dashboard (don't re-onboard); real PostgrestError message + 42501 hint.
- 67fc16e: Login friendly errors; FormInput a11y; chat inputs name attrs.
- 1d917fb: "Welcome back! We found your existing FounderHub account." toast on Google intent=register+onboarded.

## "Service temporarily unavailable" (backend not deployed — SEPARATE issue)
config.ts: API_URL = VITE_API_URL || (PROD ? '' : localhost:8001). Vercel env MISSING VITE_API_URL → prod API_URL='' → /api calls hit SPA → HTML → api.ts throws. Affects: AI generate, war-room insights, AI settings, admin AI. Auth/Register/Login/profile save NOT affected (Supabase direct). FIX requires deploying FastAPI backend (Railway/Render) + setting VITE_API_URL + redeploy frontend.

## Auth flow (no backend needed — all Supabase direct)
Create Account with existing email (Register.tsx) → "An account already exists" screen + "Continue to Sign In" (commit c441837, working). Google "Continue with Google" Create Account + existing → Callback intent=register + onboarded → /dashboard + "Welcome back" toast. Sign In + existing → /dashboard. Sign In + not-found → "Account not found" + signOut cleanup. New Google → /onboarding. Onboarding save → trigger fix unblocked it.

## Pending
- User retest: new account onboarding save (trigger fix) + existing Google account Create Account (toast + dashboard).
- Backend deploy (Railway/Render) — separate task, needs env vars (Supabase service key, OPENAI key, JWT secret, FRONTEND_URL) + set VITE_API_URL on Vercel. NOT in scope of auth fix.
