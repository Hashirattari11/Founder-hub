-- FounderHub Phase 17: Enterprise Admin / SaaS Platform
-- Idempotent — safe to run multiple times.

-- 0) Admin helper: is the current user an admin? (security definer avoids recursive RLS)
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from public.profiles where id = auth.uid()), false);
$$;

-- 1) Extend profiles with moderation / premium / super-admin fields
alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_premium boolean not null default false,
  add column if not exists is_super_admin boolean not null default false,
  add column if not exists suspended_at timestamptz,
  add column if not exists suspension_reason text,
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text;

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_is_admin_idx on public.profiles (is_admin);
create index if not exists profiles_is_verified_idx on public.profiles (is_verified);
create index if not exists profiles_is_premium_idx on public.profiles (is_premium);
create index if not exists profiles_created_at_idx on public.profiles (created_at);

-- 2) Extend startups with moderation fields
alter table public.startups
  add column if not exists is_featured boolean not null default false,
  add column if not exists is_verified boolean not null default false,
  add column if not exists is_hidden boolean not null default false;

create index if not exists startups_is_published_idx on public.startups (is_published);
create index if not exists startups_is_verified_idx on public.startups (is_verified);
create index if not exists startups_is_featured_idx on public.startups (is_featured);
create index if not exists startups_created_at_idx on public.startups (created_at);

-- 3) permissions catalog
create table if not exists public.permissions (
  code text primary key,
  name text not null,
  description text,
  module text,
  created_at timestamptz not null default now()
);

insert into public.permissions (code, name, description, module) values
  ('users.view',          'View Users',           'View user directory and activity', 'users'),
  ('users.manage',        'Manage Users',         'Edit, suspend, ban or verify users', 'users'),
  ('users.change_role',   'Change Primary Role',  'Change a user primary role', 'users'),
  ('users.reset_password','Reset Passwords',      'Reset a user password', 'users'),
  ('startups.view',       'View Startups',        'View all startups and analytics', 'startups'),
  ('startups.manage',     'Manage Startups',      'Feature, verify, hide or delete startups', 'startups'),
  ('investors.view',      'View Investors',       'View investor profiles and history', 'investors'),
  ('investors.manage',    'Manage Investors',     'Verify or reject investor verification', 'investors'),
  ('role_requests.manage','Manage Role Requests', 'Approve or reject role change requests', 'roles'),
  ('reports.manage',      'Manage Reports',       'Review and resolve user reports', 'moderation'),
  ('analytics.view',      'View Analytics',       'View platform analytics and charts', 'analytics'),
  ('health.view',         'View Health',          'View server/API/database status', 'health'),
  ('audit.view',          'View Audit Logs',      'View admin audit trail', 'security'),
  ('notifications.manage','Admin Notifications',  'Manage admin notifications', 'system'),
  ('content.manage',      'Manage Content',       'Manage landing, FAQs, blog, announcements', 'content'),
  ('ai.manage',           'Manage AI',            'Manage AI tools, prompts and usage', 'ai'),
  ('settings.manage',     'Manage Settings',      'Manage system settings and providers', 'system'),
  ('security.view',       'View Security',        'View login logs, devices and sessions', 'security')
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  module = excluded.module;

alter table public.permissions enable row level security;
drop policy if exists "Permissions readable by authenticated" on public.permissions;
create policy "Permissions readable by authenticated"
  on public.permissions for select to authenticated using (true);

-- 4) role_requests — user asks to change their primary role
create table if not exists public.role_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  from_role text,
  requested_role text not null,
  reason text,
  status text not null default 'pending'
    check (status in ('pending','approved','rejected','cancelled')),
  admin_id uuid references public.profiles(id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create index if not exists role_requests_user_idx on public.role_requests (user_id);
create index if not exists role_requests_status_idx on public.role_requests (status);

alter table public.role_requests enable row level security;
drop policy if exists "Users manage own role requests" on public.role_requests;
create policy "Users manage own role requests"
  on public.role_requests for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Admins manage all role requests" on public.role_requests;
create policy "Admins manage all role requests"
  on public.role_requests for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 5) audit_logs — every admin action
create table if not exists public.audit_logs (
  id bigint generated always as identity primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  admin_email text,
  action text not null,
  entity_type text,
  entity_id text,
  old_value jsonb,
  new_value jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);

create index if not exists audit_logs_admin_idx on public.audit_logs (admin_id);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at);
create index if not exists audit_logs_action_idx on public.audit_logs (action);

alter table public.audit_logs enable row level security;
drop policy if exists "Admins read audit logs" on public.audit_logs;
create policy "Admins read audit logs"
  on public.audit_logs for select to authenticated using (public.is_admin());

-- 6) system_settings — key/value config (secrets are masked at the API layer)
create table if not exists public.system_settings (
  key text primary key,
  value jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.system_settings (key, value) values
  ('site_name', jsonb_build_object('value', 'FounderHub')),
  ('site_logo', jsonb_build_object('value', '')),
  ('site_tagline', jsonb_build_object('value', 'Build your startup')),
  ('theme', jsonb_build_object('value', 'system')),
  ('smtp', jsonb_build_object('host', '', 'port', 587, 'secure', false)),
  ('storage', jsonb_build_object('provider', 'supabase')),
  ('stripe', jsonb_build_object('publishable_key', '', 'secret_key', '', 'webhook_secret', '', 'enabled', false)),
  ('oauth', jsonb_build_object('google_enabled', true)),
  ('ai_providers', jsonb_build_object('openai', '', 'gemini', '', 'claude', '', 'deepseek', '', 'groq', '')),
  ('rate_limit', jsonb_build_object('requests_per_minute', 120, 'enabled', true)),
  ('security', jsonb_build_object('two_factor_required', false, 'max_login_attempts', 5, 'lockout_minutes', 15)),
  ('announcement', jsonb_build_object('enabled', false, 'title', '', 'body', ''))
on conflict (key) do nothing;

alter table public.system_settings enable row level security;
drop policy if exists "Admins manage system settings" on public.system_settings;
create policy "Admins manage system settings"
  on public.system_settings for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());
drop policy if exists "Public settings are readable" on public.system_settings;
create policy "Public settings are readable"
  on public.system_settings for select to anon, authenticated
  using (key in ('site_name','site_logo','site_tagline','theme','announcement'));

-- 7) admin_notifications
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text not null,
  body text,
  data jsonb,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists admin_notifications_created_idx on public.admin_notifications (created_at);
create index if not exists admin_notifications_read_idx on public.admin_notifications (is_read);

alter table public.admin_notifications enable row level security;
drop policy if exists "Admins manage admin notifications" on public.admin_notifications;
create policy "Admins manage admin notifications"
  on public.admin_notifications for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 8) reports — user reports for moderation
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.profiles(id) on delete set null,
  report_type text not null
    check (report_type in ('spam','fake_startup','fake_investor','fake_founder','harassment','scam','other')),
  target_type text not null
    check (target_type in ('startup','investor','founder','user','post','job','message','profile','other')),
  target_id text,
  description text,
  status text not null default 'open'
    check (status in ('open','under_review','resolved','dismissed')),
  admin_id uuid references public.profiles(id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists reports_status_idx on public.reports (status);
create index if not exists reports_target_idx on public.reports (target_type, target_id);
create index if not exists reports_created_idx on public.reports (created_at);

alter table public.reports enable row level security;
drop policy if exists "Users submit and view own reports" on public.reports;
create policy "Users submit and view own reports"
  on public.reports for all to authenticated
  using (auth.uid() = reporter_id)
  with check (auth.uid() = reporter_id);
drop policy if exists "Admins manage all reports" on public.reports;
create policy "Admins manage all reports"
  on public.reports for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 9) analytics_events — DAU/MAU, page views, custom events
create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  event_type text not null,
  user_id uuid references public.profiles(id) on delete set null,
  meta jsonb,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_type_created_idx on public.analytics_events (event_type, created_at);
create index if not exists analytics_events_user_idx on public.analytics_events (user_id);
create index if not exists analytics_events_created_idx on public.analytics_events (created_at);

alter table public.analytics_events enable row level security;
drop policy if exists "Admins read analytics events" on public.analytics_events;
create policy "Admins read analytics events"
  on public.analytics_events for select to authenticated using (public.is_admin());
drop policy if exists "Authenticated insert analytics events" on public.analytics_events;
create policy "Authenticated insert analytics events"
  on public.analytics_events for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- 10) login_logs — auth security trail
create table if not exists public.login_logs (
  id bigint generated always as identity primary key,
  user_id uuid references public.profiles(id) on delete set null,
  email text,
  ip text,
  user_agent text,
  device text,
  status text not null default 'success'
    check (status in ('success','failed','logout','reset','lockout')),
  created_at timestamptz not null default now()
);

create index if not exists login_logs_user_idx on public.login_logs (user_id);
create index if not exists login_logs_created_idx on public.login_logs (created_at);

alter table public.login_logs enable row level security;
drop policy if exists "Admins read login logs" on public.login_logs;
create policy "Admins read login logs"
  on public.login_logs for select to authenticated using (public.is_admin());
drop policy if exists "Authenticated insert login logs" on public.login_logs;
create policy "Authenticated insert login logs"
  on public.login_logs for insert to authenticated
  with check (user_id is null or user_id = auth.uid());

-- 11) startup_members — per-startup permissions (Owner/Admin/Editor/Viewer)
create table if not exists public.startup_members (
  startup_id uuid not null references public.startups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  permission text not null default 'viewer'
    check (permission in ('owner','admin','editor','viewer')),
  created_at timestamptz not null default now(),
  primary key (startup_id, user_id)
);

create index if not exists startup_members_user_idx on public.startup_members (user_id);

-- Existing founders become owners of their startups
insert into public.startup_members (startup_id, user_id, permission)
select s.id, s.founder_id, 'owner'
from public.startups s
on conflict (startup_id, user_id) do nothing;

alter table public.startup_members enable row level security;
drop policy if exists "Members read their startups" on public.startup_members;
create policy "Members read their startups"
  on public.startup_members for select to authenticated
  using (
    public.is_admin()
    or exists (
      select 1 from public.startup_members sm
      where sm.startup_id = startup_members.startup_id
        and sm.user_id = auth.uid()
    )
  );
drop policy if exists "Owner and admin manage members" on public.startup_members;
create policy "Owner and admin manage members"
  on public.startup_members for all to authenticated
  using (public.is_admin() or exists (
    select 1 from public.startup_members sm
    where sm.startup_id = startup_members.startup_id
      and sm.user_id = auth.uid()
      and sm.permission in ('owner','admin')
  ))
  with check (public.is_admin() or exists (
    select 1 from public.startup_members sm
    where sm.startup_id = startup_members.startup_id
      and sm.user_id = auth.uid()
      and sm.permission in ('owner','admin')
  ));

-- 12) subscriptions — premium revenue tracking
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  plan text not null default 'pro',
  status text not null default 'active'
    check (status in ('active','trialing','past_due','canceled','expired')),
  provider text,
  provider_sub_id text,
  amount_cents integer not null default 0,
  currency text not null default 'usd',
  started_at timestamptz not null default now(),
  renews_at timestamptz,
  canceled_at timestamptz
);

create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_status_idx on public.subscriptions (status);

alter table public.subscriptions enable row level security;
drop policy if exists "Users view own subscriptions" on public.subscriptions;
create policy "Users view own subscriptions"
  on public.subscriptions for select to authenticated
  using (auth.uid() = user_id);
drop policy if exists "Admins manage subscriptions" on public.subscriptions;
create policy "Admins manage subscriptions"
  on public.subscriptions for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 13) CMS: site_content, blog_posts, announcements
create table if not exists public.site_content (
  key text primary key,
  title text,
  content text,
  meta jsonb,
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);

alter table public.site_content enable row level security;
drop policy if exists "Public site content readable" on public.site_content;
create policy "Public site content readable"
  on public.site_content for select to anon, authenticated using (true);
drop policy if exists "Admins manage site content" on public.site_content;
create policy "Admins manage site content"
  on public.site_content for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.blog_posts (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  slug text not null unique,
  excerpt text,
  content text,
  cover_url text,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  author_id uuid references public.profiles(id) on delete set null,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists blog_posts_status_idx on public.blog_posts (status);

alter table public.blog_posts enable row level security;
drop policy if exists "Published posts readable" on public.blog_posts;
create policy "Published posts readable"
  on public.blog_posts for select to anon, authenticated
  using (status = 'published');
drop policy if exists "Admins manage blog posts" on public.blog_posts;
create policy "Admins manage blog posts"
  on public.blog_posts for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  body text,
  audience text not null default 'all',
  is_active boolean not null default true,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists announcements_active_idx on public.announcements (is_active);

alter table public.announcements enable row level security;
drop policy if exists "Active announcements readable" on public.announcements;
create policy "Active announcements readable"
  on public.announcements for select to anon, authenticated using (is_active = true);
drop policy if exists "Admins manage announcements" on public.announcements;
create policy "Admins manage announcements"
  on public.announcements for all to authenticated
  using (public.is_admin())
  with check (public.is_admin());

-- 14) request_stats — daily API request counters (filled by backend middleware)
create table if not exists public.request_stats (
  day date primary key,
  requests integer not null default 0,
  errors integer not null default 0,
  avg_latency_ms double precision not null default 0
);

alter table public.request_stats enable row level security;
drop policy if exists "Admins read request stats" on public.request_stats;
create policy "Admins read request stats"
  on public.request_stats for select to authenticated using (public.is_admin());

-- 15) Triggers → admin_notifications
create or replace function public.notify_admin_new_profile()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (type, title, body, data)
  values ('registration', 'New registration',
          'A new user just signed up.',
          jsonb_build_object('user_id', NEW.id, 'full_name', NEW.full_name));
  return NEW;
end $$;

drop trigger if exists trg_admin_notify_profile on public.profiles;
create trigger trg_admin_notify_profile
  after insert on public.profiles for each row
  execute function public.notify_admin_new_profile();

create or replace function public.notify_admin_new_startup()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (type, title, body, data)
  values ('startup', 'New startup listed',
          NEW.name || ' was just published.',
          jsonb_build_object('startup_id', NEW.id, 'name', NEW.name));
  return NEW;
end $$;

drop trigger if exists trg_admin_notify_startup on public.startups;
create trigger trg_admin_notify_startup
  after insert on public.startups for each row
  execute function public.notify_admin_new_startup();

create or replace function public.notify_admin_new_report()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (type, title, body, data)
  values ('report', 'New report submitted',
          'A ' || NEW.report_type || ' report was submitted.',
          jsonb_build_object('report_id', NEW.id, 'report_type', NEW.report_type, 'target_type', NEW.target_type));
  return NEW;
end $$;

drop trigger if exists trg_admin_notify_report on public.reports;
create trigger trg_admin_notify_report
  after insert on public.reports for each row
  execute function public.notify_admin_new_report();

create or replace function public.notify_admin_new_role_request()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.admin_notifications (type, title, body, data)
  values ('role_request', 'New role request',
          'A user requested the ' || NEW.requested_role || ' role.',
          jsonb_build_object('request_id', NEW.id, 'requested_role', NEW.requested_role, 'user_id', NEW.user_id));
  return NEW;
end $$;

drop trigger if exists trg_admin_notify_role_request on public.role_requests;
create trigger trg_admin_notify_role_request
  after insert on public.role_requests for each row
  execute function public.notify_admin_new_role_request();
