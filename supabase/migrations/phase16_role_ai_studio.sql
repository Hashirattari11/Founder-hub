-- FounderHub Phase 16: Role-Based AI Studio System
-- Idempotent — safe to run multiple times.

-- 1) Expand the profiles.role CHECK constraint to all supported roles
do $$
declare cname text;
begin
  select conname into cname
  from pg_constraint
  where conrelid = 'public.profiles'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%role%';
  if cname is not null then
    execute format('alter table public.profiles drop constraint %I', cname);
  end if;
end $$;

alter table public.profiles
  add constraint profiles_role_check check (
    role in (
      'founder','developer','designer','marketer','investor',
      'legal_advisor','business_analyst','mentor','recruiter','administrator'
    )
  );

-- 2) roles
create table if not exists public.roles (
  slug text primary key,
  label text not null,
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.roles (slug, label, description, is_active) values
  ('founder',           'Founder',           'Build and grow a startup', true),
  ('developer',         'Developer',         'Write and ship software', true),
  ('designer',          'Designer',          'Design products and brands', true),
  ('marketer',          'Marketer',          'Grow audiences and revenue', true),
  ('investor',          'Investor',          'Analyze and back startups', true),
  ('legal_advisor',     'Legal Advisor',     'Provide legal guidance', true),
  ('business_analyst',  'Business Analyst',  'Analyze business data', true),
  ('mentor',            'Mentor',            'Coach founders and teams', true),
  ('recruiter',         'Recruiter',         'Hire and rank talent', true),
  ('administrator',     'Administrator',     'Manage platform and roles', true)
on conflict (slug) do update set
  label = excluded.label,
  description = excluded.description,
  is_active = excluded.is_active;

alter table public.roles enable row level security;
drop policy if exists "Roles are readable by authenticated" on public.roles;
create policy "Roles are readable by authenticated"
  on public.roles for select to authenticated using (true);

-- 3) user_roles (multiple roles per user)
create table if not exists public.user_roles (
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null references public.roles(slug) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

create index if not exists user_roles_user_idx on public.user_roles (user_id);

alter table public.user_roles enable row level security;
drop policy if exists "Users manage own extra roles" on public.user_roles;
create policy "Users manage own extra roles"
  on public.user_roles for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
drop policy if exists "Admins manage all user roles" on public.user_roles;
create policy "Admins manage all user roles"
  on public.user_roles for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 4) ai_tools (builtin catalog overrides + admin-created tools)
create table if not exists public.ai_tools (
  slug text primary key,
  name text not null,
  description text,
  category text not null default 'General',
  icon text,
  roles text[] not null default '{}',
  is_builtin boolean not null default true,
  is_enabled boolean not null default true,
  prompt_template text,
  output_format text not null default 'markdown',
  input_fields jsonb not null default '[]',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists ai_tools_category_idx on public.ai_tools (category);

alter table public.ai_tools enable row level security;
drop policy if exists "Admins manage AI tools" on public.ai_tools;
create policy "Admins manage AI tools"
  on public.ai_tools for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 5) role_permissions (per-role tool access overrides)
create table if not exists public.role_permissions (
  id uuid primary key default gen_random_uuid(),
  role text not null references public.roles(slug) on delete cascade,
  tool_slug text not null references public.ai_tools(slug) on delete cascade,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  unique (role, tool_slug)
);

create index if not exists role_permissions_role_idx on public.role_permissions (role);

alter table public.role_permissions enable row level security;
drop policy if exists "Admins manage role permissions" on public.role_permissions;
create policy "Admins manage role permissions"
  on public.role_permissions for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- 6) user_preferences (per-user key/value)
create table if not exists public.user_preferences (
  user_id uuid not null references public.profiles(id) on delete cascade,
  key text not null,
  value jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_preferences enable row level security;
drop policy if exists "Users manage own preferences" on public.user_preferences;
create policy "Users manage own preferences"
  on public.user_preferences for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 7) ai_usage_logs (admin analytics)
create table if not exists public.ai_usage_logs (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  tool_slug text not null,
  provider text,
  status text not null default 'success',
  error text,
  created_at timestamptz not null default now()
);

create index if not exists ai_usage_logs_user_idx on public.ai_usage_logs (user_id);
create index if not exists ai_usage_logs_tool_idx on public.ai_usage_logs (tool_slug);
create index if not exists ai_usage_logs_created_idx on public.ai_usage_logs (created_at);

alter table public.ai_usage_logs enable row level security;
drop policy if exists "Admins read AI usage logs" on public.ai_usage_logs;
create policy "Admins read AI usage logs"
  on public.ai_usage_logs for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
