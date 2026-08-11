# Project Context

## Environment
- Frontend: React 19 + Vite + TS (`frontend/`), deploy: Vercel (founder-hub-0.vercel.app)
- Backend: FastAPI + Supabase (`backend/`), deploy: Railway
- Mobile: Expo (out of scope — no Google OAuth)
- Tests: `npm run build` (tsc -b + vite build)
- Package Manager: npm

## Root Cause (PKCE Auth Error)
- `frontend/src/lib/supabase.ts` sets `detectSessionInUrl: true`
- `frontend/src/pages/auth/Callback.tsx` ALSO manually calls `exchangeCodeForSession(code)`
- Result: double exchange — client init auto-exchanges (consumes+deletes PKCE verifier), then manual call fails: "PKCE code verifier not found in storage"
- FIX: `detectSessionInUrl: false` + manual exchange only in Callback

## Google OAuth Flows
- Login.tsx:80 → signInWithOAuth, redirectTo `${APP_URL}/auth/callback`
- Register.tsx: email signup only (NO Google button yet)
- Callback.tsx: current logic (lines 1-60): checks profile.full_name, email-confirmation redirect, error if no code

## DB Trigger (already correct)
- `handle_new_user` auto-creates profile (id, full_name from metadata, role='founder') for ALL auth users (incl. Google)
- `protect_role_columns`: role only changeable when `old.username IS NULL` (role permanence)
- Discriminator: `username IS NOT NULL` = real/onboarded account

## Backend (COMPLETE — no changes needed)
- admin.py:924 approve → role_approved email; admin.py:1017 reject → role_rejected email; change-role (line 439) → role_approved email
- role_requests.py: create request; RequireAdmin; RLS blocks self is_admin grant

## Frontend Files to Fix
1. lib/supabase.ts — detectSessionInUrl: false
2. pages/auth/Callback.tsx — rewrite (intent param, account-not-found, signOut cleanup)
3. pages/auth/Login.tsx — add ?intent=signin to Google redirectTo
4. pages/auth/Register.tsx — add Google button ?intent=register
5. pages/profile/CompleteProfile.tsx — username auto-suggest, role editable while !username, onboarding title
6. NEW lib/username.ts — suggestUsername from full name + availability
7. NEW lib/profileCompletion.ts — completion calc (80% gate)
8. NEW components/ProfileGate.tsx — route guard for important actions
9. NEW components/ProfileCompletionCard.tsx — dashboard progress
10. App.tsx — /onboarding alias; ProfileGate wrap; DashboardLayout card

## Route Guard Target (important actions)
- /startups/create, /jobs/post, /messages, /connections (+ /book-meeting/:userId if exists)
- NOTE: gate computes from actual data — existing users with name+username+role+bio+skills pass

## Key Config Values
- APP_URL derives from window.location.origin (prod = founder-hub-0.vercel.app, no hardcoded localhost in prod paths)
- supabase.ts exports: createClient (single instance), database (client), SERVICE_ROLE (server-only), ADMIN_ROLES, APP_URL, isUserAdmin, setTemporaryRole, removeTemporaryRole, signOut
- AuthContext: session state, realtime role sync channel (auth-profile-sync)

## Current Status (2026-08-11 06:14)
NEW MISSION: Automated QA framework (Playwright). Setup COMPLETE. First run: 16 passed, 13 failed, 13 skipped.

### QA Framework (created)
- frontend/playwright.config.ts: BASE_URL env (default http://localhost:5173, auto-starts vite), Chromium, screenshot/video/trace retain-on-failure, HTML reporter, test 60s/expect 15s
- frontend/tests/helpers.ts: ROUTES registry (public/protected/admin), attachErrorCollectors (console/page/requestfailed), markUnverified, QA_TARGET
- tests: smoke/app-load, smoke/routes, auth/auth, onboarding/onboarding, roles/roles, messaging/messaging, features/features (community/startups/jobs/meetings), admin/admin, accessibility/a11y, email/email-pipeline
- package.json scripts: test:e2e, test:e2e:ui, test:e2e:report, test:a11y
- .gitignore: +test-results/, playwright-report/, playwright/.cache/

### FIRST RUN RESULTS (16P/13F/13S)
FAILED (need investigation):
- 7x a11y: /, /register, /forgot-password, /terms, /privacy, /contact (axe violations — REAL, investigate which rules)
- 3x auth: Sign In renders, Create Account renders, forgot-password renders
- 1x auth: account-not-found flow (static loading-state assertion failed?)
- 1x roles: role dashboards redirect
- 1x app-load homepage
- 1x routes smoke (net::ERR_ABORTED at / during retry — likely rapid-nav flake)
PASSED 16: login a11y passed? (not listed), callback error test passed, most public legal pages in route smoke? (some), email pipeline contract, messaging/auth redirects, etc.
SKIPPED 13: all credential-gated (onboarding wizard, roles RBAC, messaging flow, community/startups/jobs/meetings features, admin panels, role-request pipeline, real inbox delivery)

KEY: ERR_ABORTED flake observed (net::ERR_ABORTED at http://localhost:5173/) — likely from one giant 40-route test + fullyParallel. Fix: split route smoke into per-route tests (for-of creating test()), retry single nav, maybe waitUntil 'commit'.

### PENDING (user: fix all → git push → redeploy)
1. Get full failure details (playwright-results file / re-run focused)
2. Fix a11y violations in APP if real (contrast/labels/headings) OR fix test if false-positive
3. Fix auth page test failures (find why Sign In/Create Account/forgot-password render failed)
4. Fix route smoke ERR_ABORTED flake
5. Re-run full suite until green (honestly — no faking)
6. Update todo.md + qa-report.md with real counts
7. git push (backend? frontend? both — QA touched only frontend/playwright config + tests) + redeploy (vercel --prod)

### Environment notes
- Vite dev: 5173, proxy /api→127.0.0.1:8001 (backend may be DOWN locally — API failures possible, don't hard-fail)
- Real Supabase cloud project used by dev app
- No E2E test creds set → auth-dependent flows skip/UNVERIFIED

DONE (verified by build):
- src/lib/supabase.ts: detectSessionInUrl: false (PKCE double-exchange root cause fix)
- src/pages/auth/Callback.tsx: rewritten — single manual exchangeCodeForSession, intent param (signin/register/none), account-not-found card + signOut cleanup for signin w/o account, PKCE-friendly error, admin redirect, update-password redirect, username-based onboarding check
- src/pages/auth/Login.tsx: Google redirectTo .../auth/callback?intent=signin
- src/pages/auth/Register.tsx: added Continue-with-Google button (intent=register) + divider
- src/lib/username.ts (NEW): suggestUsername, isUsernameAvailable, findAvailableUsername
- src/lib/profileCompletion.ts (NEW): calculateProfileCompletion (weighted, 80% threshold), isProfileComplete
- src/components/ProfileGate.tsx (NEW): full-screen gate UI
- src/components/ProfileGateRoute.tsx (NEW): route wrapper (useSession + calc + gate)
- src/components/ProfileCompletionCard.tsx (NEW): dashboard banner
- src/pages/profile/CompleteProfile.tsx: roleAlreadySet = Boolean(profile?.username) (role permanence), onboarding title when !username, username suggest button
- src/pages/profile/EditProfile.tsx: roleWasSet = Boolean(prevProfile?.username); role chooser shows when !profile?.username
- src/App.tsx: /onboarding route (alias of CompleteProfile); ProfileGateRoute wraps /book-meeting/:userId, /connections, /jobs/post, /startups/create
- src/components/dashboard/DashboardLayout.tsx: ProfileCompletionCard banner (named→default import fixed)

Backend: NO changes needed — role_approved (change-role L439, approve L1006), role_rejected (L1052) emails already present; RequireAdmin + RLS + handle_new_user trigger + protect_role_columns already in place from previous mission.

## Pending Tasks
- Update .opencode/todo.md (mission tracking) + work-log.md + auth-report.md
- (Optional) run lsp_diagnostics / final Reviewer pass — agent delegation is UNRELIABLE this session (4 agents reported DONE w/o doing work; did implementation directly as Commander)
- Optionally deploy (not requested)

## Current Status (2026-08-11 06:24)
- Mission: Fix QA test failures, git push, redeploy frontend (Vercel prod). User urgent: "fata fat".
- All 6 fixes APPLIED (frontend):
  1. src/index.css � dark-mode AA fix: .dark .text-primary/.hover\:text-primary:hover -> #a78bfa (was #7c3aed = 3.17:1 fail on dark-100; light mode untouched)
  2. src/components/FormInput.tsx � Field uses useId + cloneElement to wire label htmlFor<->input id + aria-describedby error (fixes getByLabel fails + axe select-name)
  3. tests/smoke/routes.spec.ts � 40-route single test SPLIT into one test() per route (kills ERR_ABORTED cascade)
  4. tests/smoke/app-load.spec.ts � getByText('From Idea to') -> getByRole('heading', {name:/From Idea to/i}) (strict-mode violation: h1 + footer both match)
  5. tests/auth/auth.spec.ts � account-not-found now expects /auth/callback -> "Verification failed" + "Missing authorization code" (confirmed Callback.tsx L27/L125; no-code callback shows error state, not loading)
  6. tests/roles/roles.spec.ts � /dashboard -> /login redirect; /dashboard/founder + /dashboard/investor -> NotFound 404 (heading '404', text 'This page went to orbit') since role URLs DON'T exist as routes
- BACKGROUND BUILD job_01cf88d6: "npm run build" (tsc -b && vite build) � RUNNING 1m+ (normally ~14s), NOT yet green. Earlier attempt job_30bbe129 failed instantly: run_background uses cmd.exe, Out-String pipe not recognized � DO NOT use PowerShell pipes in run_background.
- NOT yet run: full 
px playwright test after fixes; git commit/push; 
px vercel --prod.

## Pending Tasks (order)
1. Wait for job_01cf88d6 build result (must be exit 0).
2. Run 
px playwright test (background, NO pipes � plain command, cwd frontend). Expect: 13 failures fixed (7 a11y + 3 auth + 1 roles + 1 app-load + 1 routes-flake). Possible remaining: color-contrast text-gray-600 (#6b7278) on #111111 = 3.9:1 node on homepage � if fails, find element and add dark: text-gray-400.
3. Write .opencode/qa-report.md (TOTAL/PASSED/FAILED/SKIPPED/UNVERIFIED + ???????? + failing files + deploy verdict).
4. git add -A (repo root D:\founderhub) + commit "fix(frontend): WCAG AA dark-mode contrast + form label associations; harden Playwright suite" + git push (branch main).
5. cd frontend; npx vercel --prod (deploy founder-hub-0.vercel.app; prod callback URL already in Supabase allowlist).
6. Update todo.md/work-log.md; conclude.

## Notes
- Agents unreliable this session (reported DONE without work) � Commander implements directly. No delegation for fixes; use Reviewer only for final verify if needed.
- Windows PowerShell 5.1: glob src\**\*.tsx does NOT recurse � use grep tool. run_background executes via cmd.exe (no Out-String).
- App facts: no /signup (use /register), no /startups (use /explore), no /dashboard/founder|investor routes (404). NotFound: bg-dark, heading '404', 'This page went to orbit'.
- E2E creds still unset ? 13 credential-gated tests stay SKIPPED/UNVERIFIED (honest, not faked).
