-- FounderHub AI — Phase 2 schema
-- Run in: Supabase Dashboard → SQL Editor
-- Idempotent: safe to run multiple times.

-- ============================================================
-- 1) STARTUPS: funding_needed becomes text (dropdown categories)
--    + remote_friendly + updated_at + full-text search column
-- ============================================================
alter table public.startups alter column funding_needed type text using funding_needed::text;
alter table public.startups add column if not exists remote_friendly boolean default true;
alter table public.startups add column if not exists updated_at timestamptz default now();

alter table public.startups add column if not exists fts tsvector
  generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(tagline, '') || ' ' ||
      coalesce(description, '')
    )
  ) stored;

create index if not exists startups_fts_idx on public.startups using gin (fts);

-- ============================================================
-- 2) PROFILES: investor interests + connection count
-- ============================================================
alter table public.profiles add column if not exists investor_interests text[];
alter table public.profiles add column if not exists connections_count integer default 0;

-- ============================================================
-- 3) STARTUP VIEWS (analytics + recently viewed)
-- ============================================================
create table if not exists public.startup_views (
  id uuid default gen_random_uuid() primary key,
  startup_id uuid references public.startups(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  viewed_at timestamptz default now()
);

alter table public.startup_views enable row level security;

drop policy if exists "Users can view own views" on public.startup_views;
create policy "Users can view own views"
  on public.startup_views for select
  to authenticated
  using (viewer_id = auth.uid());

drop policy if exists "Users can record views" on public.startup_views;
create policy "Users can record views"
  on public.startup_views for insert
  to authenticated
  with check (viewer_id = auth.uid());

-- Founders can read views on their own startups (for analytics)
drop policy if exists "Founders can view views on own startups" on public.startup_views;
create policy "Founders can view views on own startups"
  on public.startup_views for select
  to authenticated
  using (
    exists (
      select 1 from public.startups s
      where s.id = startup_id and s.founder_id = auth.uid()
    )
  );

-- ============================================================
-- 4) CONNECTIONS
-- ============================================================
create table if not exists public.connections (
  requester_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  primary key (requester_id, receiver_id)
);

alter table public.connections enable row level security;

drop policy if exists "Users can view own connections" on public.connections;
create policy "Users can view own connections"
  on public.connections for select
  to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users can request connections" on public.connections;
create policy "Users can request connections"
  on public.connections for insert
  to authenticated
  with check (requester_id = auth.uid());

drop policy if exists "Users can update own connections" on public.connections;
create policy "Users can update own connections"
  on public.connections for update
  to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid())
  with check (requester_id = auth.uid() or receiver_id = auth.uid());

drop policy if exists "Users can delete own connections" on public.connections;
create policy "Users can delete own connections"
  on public.connections for delete
  to authenticated
  using (requester_id = auth.uid() or receiver_id = auth.uid());

-- ============================================================
-- 5) NOTIFICATIONS: allow users to insert their own
-- ============================================================
drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid());

-- ============================================================
-- 6) SAVED STARTUPS: view data for public card queries
--    (already exists — no changes needed)

-- ============================================================
-- USEFUL INDEXES
-- ============================================================
create index if not exists startups_updated_at_idx on public.startups (updated_at desc);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_created_at_idx on public.applications (created_at desc);
create index if not exists startup_views_startup_id_idx on public.startup_views (startup_id);
create index if not exists startup_views_viewer_id_idx on public.startup_views (viewer_id);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
