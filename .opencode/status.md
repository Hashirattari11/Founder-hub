# Mission Status

## Progress
- .opencode/todo.md: 15/16 (94%) — only final Reviewer pass pending
- Issues: 0 unresolved
- Workers: 0 active (frontend build check running)
- Verification Strategy: RLS/grant/trigger exploit simulation + prod API checks
- Execution Status: pass (pending final todo check-off)

## Current Phase
Final verification (todo.md S4.1.1 check-off pending)

## Summary of Mission
Account Settings Ownership Security Fix — user complained anyone could change anyone's account settings. Root cause: user_roles self-admin policy + profiles table-level grants exposing privileged columns + unprotected INSERT path + admin PATCH accepting personal fields.

### Fixed
1. **user_roles RLS**: "Users manage own extra roles" (ALL) dropped → SELECT-only "Users can view own roles". Self-admin INSERT → 42501 blocked.
2. **profiles grants**: REVOKE ALL for authenticated/anon → SELECT all + INSERT/UPDATE only owner-editable columns. is_admin/is_verified/is_premium/suspended/banned/id/created_at/connections_count → no client UPDATE/INSERT. is_online/last_seen kept (presence heartbeat).
3. **protect_role_columns trigger**: now INSERT OR UPDATE; blocks privileged flags on both paths; role changes require onboarding state (username null) and never admin roles.
4. **backend admin_update_user**: UpdateUserRequest → moderation-only (is_verified, is_premium). Admin can no longer edit personal account settings.
5. Commit e9817c6 pushed + deployed (dpl_FymSjUGN7E52XbsqYk79J6RYDvih READY).

### Verified (evidence)
- Self-admin INSERT user_roles → 42501 RLS violation
- is_verified / is_admin UPDATE → 42501 permission denied
- Other-user profile UPDATE → 0 rows (RLS)
- role='admin' INSERT → 42501 permission denied
- Owner self-update (full_name/bio/skills) → works
- has_column_privilege matrix confirmed
- RLS ON for 9 tables
- LSP clean; IMPORT-OK 223; prod GET / 200; PATCH admin → 401 (route live)
