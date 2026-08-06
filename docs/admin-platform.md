# Admin Platform

Phase 17 module: a full enterprise admin console for the platform on web
(`/admin/*`, entry "Admin Console") and Expo mobile (Profile → "Admin Console").
Backed by the `/api/admin` router plus the role-requests and reports APIs.
Covers user management, startup moderation, role requests, reports, analytics,
health, audit logs, admin notifications, CMS (site content, blog, announcements),
AI usage, settings, security (login logs + 2FA policy), subscriptions and
per-startup member permissions.

## Access model

- **Admin** = `profiles.is_admin = true` OR primary role
  `administrator`/`admin` (frontend mirrors backend via
  `isAdminProfile`). Non-admins hitting `/admin/*` are redirected
  (web: `/dashboard`, mobile: `/`); the API itself returns 403.
- **Super Admin** = `profiles.is_super_admin = true`. The env-configured super
  admin email is auto-(re)promoted on every request so the account can never
  lose admin access. Super-Admin-gated actions: change primary role, reset
  passwords, delete users/startups, approve/reject role requests, save settings,
  change security policy.
- The super admin is configured via backend env (`SUPER_ADMIN_EMAIL` /
  `SUPER_ADMIN_PASSWORD`); there are no hardcoded credentials in the frontend.
- An admin's daily workflow starts from the sidebar **Admin Console** link or,
  on mobile, the **Admin Console** button on the profile tab.

## Backend API

Router `backend/app/api/admin.py` (dependencies in
`backend/app/core/security.py`), plus `backend/app/api/role_requests.py` and
`backend/app/api/reports.py`. All admin routes require `RequireAdmin` (403
"Admins only" otherwise) and run on the service client (RLS-safe).

- `GET /api/admin/me` — profile, unread notification count, permission list.
- `GET /api/admin/overview` — totals for users, startups, investors, pending
  role requests, open reports, unread notifications, subscriptions (active +
  MRR in cents) and today's request stats.
- Users: `GET /users` (search/role/verified/limit), `PATCH /users/{id}`,
  `POST /users/{id}/verify|suspend|unsuspend|ban|unban`,
  `POST /users/{id}/change-role` + `reset-password` + `DELETE /users/{id}`
  (all three Super-Admin only).
- Startups: `GET /startups`, `PATCH /startups/{id}` (flags
  `is_featured/is_verified/is_hidden/is_published`), `DELETE /startups/{id}`
  (Super Admin).
- `GET /investors`, `GET /role-requests` + approve/reject (Super Admin),
  `GET /reports` + resolve/dismiss.
- `GET /analytics` — DAU/MAU, 30-day registrations, request stats incl.
  per-endpoint breakdown. `GET /health` — API + Supabase + AI provider checks.
- `GET /audit-logs` — audited admin actions (suspends, role changes, settings,
  deletions, etc.).
- `GET /notifications`, `POST /notifications/{id}/read`,
  `POST /notifications/read-all`, `DELETE /notifications/{id}`.
- CMS: `GET /cms/site-content`, `PUT /cms/site-content/{key}`, blog CRUD,
  announcements CRUD.
- AI: `GET /ai/usage`, `GET /ai/analytics`.
- Settings: `GET /settings` (values arrive masked for secret keys),
  `PUT /settings` (Super Admin; accepts `{settings}`).
- Security: `GET /security/login-logs` (statuses
  `success/failed/logout/reset/lockout`), `POST /security/settings`
  (Super Admin; `two_factor_required`, `max_login_attempts`,
  `lockout_minutes`).
- Subscriptions: `GET /subscriptions?status=`. Startup members:
  `GET /startup-members?startup_id=`, `POST /startup-members`,
  `DELETE /startup-members/{startup_id}/{user_id}` with per-startup
  permissions `owner/admin/editor/viewer` that never touch the primary role.

## Frontend (web)

- `frontend/src/components/AdminRoute.tsx` — auth + `isAdminProfile` guard.
- `frontend/src/pages/admin/AdminLayout.tsx` — sidebar shell with nav,
  mobile drawer, notification bell, sign-out.
- `frontend/src/pages/admin/adminUi.tsx` — shared PageHeader/Card/StatCard/
  Badge/table + date/money/status formatters.
- Pages: AdminDashboard, AdminUsers, AdminStartups, AdminInvestors,
  AdminRoleRequests, AdminReports, AdminAnalytics (Recharts),
  AdminHealth, AdminAuditLogs, AdminNotifications, AdminCms, AdminAi,
  AdminSettings (JSON-per-key, secret masking preserved), AdminSecurity,
  AdminSubscriptions, AdminStartupMembers.
- Client: `frontend/src/api/admin.ts`, helpers `frontend/src/lib/admin.ts`.
  Routes registered in `frontend/src/App.tsx` under `/admin`.
- Admin login redirects: `Login.tsx` and `Callback.tsx` route admins to
  `/admin/dashboard`.

## Frontend (mobile)

- Guarded stack in `mobile/app/admin/_layout.tsx` (session + `isAdminProfile`,
  otherwise replaces to `/`).
- Screens: `index` (menu + overview), `users`, `startups`, `role-requests`,
  `reports`, `analytics`, `notifications`, `startup-members`.
- Client: `mobile/src/lib/adminApi.ts`, helpers `mobile/src/lib/admin.ts`,
  types `mobile/src/types/admin.ts`. Registered in `mobile/app/_layout.tsx`.

## Database

Migrations `phase17_admin_platform.sql` and `phase17_request_stats_rpc.sql`
add 14 admin tables (permissions, role_requests, reports, admin_notifications,
audit_logs, site_content, blog_posts, announcements, login_logs, subscriptions,
startup_members, request_stats, security_settings, app_settings) plus
triggers/stored procedures, and promote the super admin profile
(administrator / is_admin / is_super_admin / is_verified).

## Verification

- Frontend: `npm run build` (runs `tsc -b && vite build`).
- Mobile: `npx tsc --noEmit` in `mobile/`.
- API: admin token → 200 on all `/api/admin/*`; non-admin token → 403.
