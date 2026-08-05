-- =============================================================
-- Phase 5: Investor Dashboard + Smart Email Notification System
-- Run in Supabase SQL Editor. Idempotent — safe to re-run.
-- =============================================================

-- ---------- Investor preferences ----------
alter table public.profiles add column if not exists portfolio_companies text[];
alter table public.profiles add column if not exists investment_range_min bigint default 0;
alter table public.profiles add column if not exists investment_range_max bigint default 1000000;
alter table public.profiles add column if not exists investment_stage text[] default array['idea','mvp'];

-- ---------- Notification preferences ----------
alter table public.profiles add column if not exists notification_preferences jsonb default '{
  "email_new_match": true,
  "email_new_application": true,
  "email_status_update": true,
  "email_messages": false,
  "push_new_match": true,
  "push_new_application": true
}'::jsonb;

-- ---------- Admin flag ----------
alter table public.profiles add column if not exists is_admin boolean default false;

-- ---------- Email logs ----------
create table if not exists public.email_logs (
  id uuid default gen_random_uuid() primary key,
  startup_id uuid references public.startups(id) on delete cascade,
  recipient_id uuid references public.profiles(id) on delete cascade,
  recipient_email text not null,
  email_type text not null,
  match_score integer,
  status text default 'sent',
  sent_at timestamptz default now()
);

-- ---------- Follows (people) ----------
create table if not exists public.follows (
  follower_id uuid references public.profiles(id) on delete cascade,
  following_id uuid references public.profiles(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (follower_id, following_id)
);

-- ---------- Startup follows ----------
create table if not exists public.startup_follows (
  user_id uuid references public.profiles(id) on delete cascade,
  startup_id uuid references public.startups(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, startup_id)
);

-- ---------- RLS ----------
alter table public.email_logs enable row level security;
alter table public.follows enable row level security;
alter table public.startup_follows enable row level security;

-- Email logs: owner sees their own log rows (admin view goes through backend).
drop policy if exists "Users view own email logs" on public.email_logs;
create policy "Users view own email logs"
  on public.email_logs for select
  using (auth.uid() = recipient_id);

-- Follows: followers manage their rows; everyone can view.
drop policy if exists "Users manage own follows" on public.follows;
create policy "Users manage own follows"
  on public.follows for all
  using (auth.uid() = follower_id);

drop policy if exists "Anyone can view follows" on public.follows;
create policy "Anyone can view follows"
  on public.follows for select
  using (true);

-- Startup follows: user manages own rows; everyone can view.
drop policy if exists "Users manage own startup follows" on public.startup_follows;
create policy "Users manage own startup follows"
  on public.startup_follows for all
  using (auth.uid() = user_id);

drop policy if exists "Anyone can view startup follows" on public.startup_follows;
create policy "Anyone can view startup follows"
  on public.startup_follows for select
  using (true);

-- ---------- Indexes ----------
create index if not exists email_logs_startup_id_idx on public.email_logs (startup_id);
create index if not exists email_logs_recipient_id_idx on public.email_logs (recipient_id);
create index if not exists follows_following_id_idx on public.follows (following_id);
create index if not exists startup_follows_startup_id_idx on public.startup_follows (startup_id);
