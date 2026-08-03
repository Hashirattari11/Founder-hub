-- FounderHub AI — Phase 1 schema
-- Run in: Supabase Dashboard → SQL Editor
-- Idempotent: safe to run multiple times.

-- ============================================================
-- 1) PROFILES (already created — ensure required columns exist)
-- ============================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  username text unique,
  avatar_url text,
  bio text,
  role text check (role in ('founder','developer','designer','investor','marketer')),
  skills text[],
  country text,
  city text,
  experience_years integer,
  linkedin_url text,
  github_url text,
  portfolio_url text,
  twitter_url text,
  is_open_to_work boolean default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- 2) STARTUPS
-- ============================================================
create table if not exists public.startups (
  id uuid default gen_random_uuid() primary key,
  founder_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  tagline text,
  description text,
  industry text,
  stage text check (stage in ('idea','mvp','growth','scaling')),
  funding_needed bigint,
  equity_offered numeric(5,2),
  location text,
  website_url text,
  pitch_deck_url text,
  tech_stack text[],
  team_roles_needed text[],
  is_published boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 3) APPLICATIONS
-- ============================================================
create table if not exists public.applications (
  id uuid default gen_random_uuid() primary key,
  startup_id uuid references public.startups(id) on delete cascade,
  applicant_id uuid references public.profiles(id) on delete cascade,
  role_applying_for text,
  cover_message text,
  status text default 'pending' check (status in ('pending','shortlisted','accepted','rejected')),
  created_at timestamptz default now(),
  unique (startup_id, applicant_id)
);

-- ============================================================
-- 4) MESSAGES
-- ============================================================
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  sender_id uuid references public.profiles(id),
  receiver_id uuid references public.profiles(id),
  content text not null,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 5) NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text,
  title text,
  body text,
  data jsonb,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 6) SAVED STARTUPS
-- ============================================================
create table if not exists public.saved_startups (
  user_id uuid references public.profiles(id) on delete cascade,
  startup_id uuid references public.startups(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, startup_id)
);

-- ============================================================
-- RLS — enable on all tables
-- ============================================================
alter table public.startups enable row level security;
alter table public.applications enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_startups enable row level security;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- --- PROFILES: anyone can read, owner can update/insert ---
drop policy if exists "Profiles are publicly viewable" on public.profiles;
create policy "Profiles are publicly viewable"
  on public.profiles for select
  to anon, authenticated
  using (true);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- --- STARTUPS: published are public, only founder can manage own ---
drop policy if exists "Published startups are publicly viewable" on public.startups;
create policy "Published startups are publicly viewable"
  on public.startups for select
  to anon, authenticated
  using (is_published = true);

drop policy if exists "Founders can view own unpublished startups" on public.startups;
create policy "Founders can view own unpublished startups"
  on public.startups for select
  to authenticated
  using (founder_id = auth.uid());

drop policy if exists "Founders can insert startups" on public.startups;
create policy "Founders can insert startups"
  on public.startups for insert
  to authenticated
  with check (founder_id = auth.uid());

drop policy if exists "Founders can update own startups" on public.startups;
create policy "Founders can update own startups"
  on public.startups for update
  to authenticated
  using (founder_id = auth.uid())
  with check (founder_id = auth.uid());

drop policy if exists "Founders can delete own startups" on public.startups;
create policy "Founders can delete own startups"
  on public.startups for delete
  to authenticated
  using (founder_id = auth.uid());

-- --- APPLICATIONS: applicant and startup founder can view ---
drop policy if exists "Applicants can view own applications" on public.applications;
create policy "Applicants can view own applications"
  on public.applications for select
  to authenticated
  using (applicant_id = auth.uid());

drop policy if exists "Founders can view applications to own startups" on public.applications;
create policy "Founders can view applications to own startups"
  on public.applications for select
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.founder_id = auth.uid()
    )
  );

drop policy if exists "Users can submit applications" on public.applications;
create policy "Users can submit applications"
  on public.applications for insert
  to authenticated
  with check (applicant_id = auth.uid());

drop policy if exists "Founders can update applications to own startups" on public.applications;
create policy "Founders can update applications to own startups"
  on public.applications for update
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.founder_id = auth.uid()
    )
  );

-- --- MESSAGES: only sender and receiver can view ---
drop policy if exists "Users can view own messages" on public.messages;
create policy "Users can view own messages"
  on public.messages for select
  to authenticated
  using (sender_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users can send messages" on public.messages;
create policy "Users can send messages"
  on public.messages for insert
  to authenticated
  with check (sender_id = auth.uid());

-- --- NOTIFICATIONS: only the target user ---
drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- --- SAVED STARTUPS: owner only ---
drop policy if exists "Users can view own saved startups" on public.saved_startups;
create policy "Users can view own saved startups"
  on public.saved_startups for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can save startups" on public.saved_startups;
create policy "Users can save startups"
  on public.saved_startups for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can unsave startups" on public.saved_startups;
create policy "Users can unsave startups"
  on public.saved_startups for delete
  to authenticated
  using (user_id = auth.uid());

-- ============================================================
-- USEFUL INDEXES
-- ============================================================
create index if not exists startups_industry_idx on public.startups (industry);
create index if not exists startups_stage_idx on public.startups (stage);
create index if not exists startups_founder_id_idx on public.startups (founder_id);
create index if not exists applications_startup_id_idx on public.applications (startup_id);
create index if not exists applications_applicant_id_idx on public.applications (applicant_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_receiver_id_idx on public.messages (receiver_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
