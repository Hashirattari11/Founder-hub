# Mission: Auth Spec — Google OAuth PKCE Fix + Account Creation + Role Permanence + Profile Gate

> Goal: Fix "PKCE code verifier not found in storage" + implement auth spec: create-account onboarding, account-not-found for sign-in, role permanence + approval emails, admin protection, profile completion gate.
> Execution note: Agent delegation was unreliable this session (4 agents reported DONE without doing work). Commander implemented directly; verification via tsc + vite build.

## M1: Auth PKCE Fix | status: completed
### T1.1: Auth core | status: completed
- [x] S1.1.1: supabase.ts → detectSessionInUrl: false (kills double-exchange) | size:S
- [x] S1.1.2: Callback.tsx rewrite (single manual exchange, intent param, account-not-found + signOut cleanup, PKCE-friendly error) | size:M
- [x] S1.1.3: Login.tsx → Google redirectTo ?intent=signin | size:S
- [x] S1.1.4: Register.tsx → Google button ?intent=register | size:S
### T1.2: Auth core verification | status: completed
- [x] S1.2.1: npm run build passes (tsc -b + vite build, exit 0) | size:S

## M2: Onboarding + Account Creation | status: completed
### T2.1: New utilities | status: completed
- [x] S2.1.1: lib/username.ts (suggestUsername, isUsernameAvailable, findAvailableUsername) | size:S
- [x] S2.1.2: lib/profileCompletion.ts (weighted calc, 80% threshold, isProfileComplete) | size:S
- [x] S2.1.3: components/ProfileGate.tsx (full-screen gate UI) | size:S
- [x] S2.1.4: components/ProfileGateRoute.tsx (route wrapper) | size:S
- [x] S2.1.5: components/ProfileCompletionCard.tsx (dashboard banner) | size:S
### T2.2: Onboarding wiring | status: completed
- [x] S2.2.1: CompleteProfile.tsx → username suggest, role editable while !username, onboarding title | size:M
- [x] S2.2.2: EditProfile.tsx → role permanence consistency (username-based) | size:S
- [x] S2.2.3: App.tsx → /onboarding route + ProfileGateRoute on /book-meeting/:userId, /connections, /jobs/post, /startups/create | size:M
- [x] S2.2.4: DashboardLayout.tsx → ProfileCompletionCard banner | size:S
### T2.3: Onboarding verification | status: completed
- [x] S2.3.1: build passes | size:S

## M3: Role Permanence + Emails + Admin | status: completed
### T3.1: Audit | status: completed
- [x] S3.1.1: Backend role approve (L1006 role_approved) / reject (L1052 role_rejected) / change-role (L439 role_approved) emails CONFIRMED present — no code change needed | size:S
- [x] S3.1.2: protect_role_columns trigger + RLS + RequireAdmin + handle_new_user trigger CONFIRMED (previous mission) — role permanence enforced DB-side | size:S

## M4: Final Verification | status: completed
### T4.1: Full system check | status: completed
- [x] S4.1.1: tsc --noEmit clean (0 errors) | size:S
- [x] S4.1.2: npm run build passes (BUILD_EXIT=0) | size:S
- [x] S4.1.3: .opencode/auth-report.md written | size:S
