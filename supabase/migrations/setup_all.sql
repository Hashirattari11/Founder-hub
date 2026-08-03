-- ============================================================
-- FounderHub AI — COMPLETE ONE-TIME SETUP
-- Run the ENTIRE contents in: Supabase Dashboard → SQL Editor
-- Idempotent: safe to run again if it fails partway.
-- ============================================================

-- ============================================================
-- 0) FIX PROFILES TABLE (drop stale user_id column)
-- ============================================================
drop index if exists profiles_user_id_key;
drop index if exists profiles_user_id_idx;
alter table public.profiles drop constraint if exists profiles_user_id_fkey;
alter table public.profiles drop constraint if exists profiles_user_id_key;
alter table public.profiles drop column if exists user_id;

-- ============================================================
-- 1) PROFILES TABLE
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
  investor_interests text[],
  connections_count integer default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Add any columns missing from older schema versions
alter table public.profiles add column if not exists username text;
alter table public.profiles add column if not exists avatar_url text;
alter table public.profiles add column if not exists skills text[];
alter table public.profiles add column if not exists country text;
alter table public.profiles add column if not exists city text;
alter table public.profiles add column if not exists experience_years integer;
alter table public.profiles add column if not exists linkedin_url text;
alter table public.profiles add column if not exists github_url text;
alter table public.profiles add column if not exists portfolio_url text;
alter table public.profiles add column if not exists twitter_url text;
alter table public.profiles add column if not exists is_open_to_work boolean default true;
alter table public.profiles add column if not exists investor_interests text[];
alter table public.profiles add column if not exists connections_count integer default 0;

create unique index if not exists profiles_username_key on public.profiles (username) where username is not null;

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
  funding_needed text,
  equity_offered numeric(5,2),
  remote_friendly boolean default true,
  location text,
  website_url text,
  pitch_deck_url text,
  tech_stack text[],
  team_roles_needed text[],
  is_published boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
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
-- 7) STARTUP VIEWS (analytics + recently viewed)
-- ============================================================
create table if not exists public.startup_views (
  id uuid default gen_random_uuid() primary key,
  startup_id uuid references public.startups(id) on delete cascade,
  viewer_id uuid references public.profiles(id) on delete set null,
  viewed_at timestamptz default now()
);

-- ============================================================
-- 8) CONNECTIONS
-- ============================================================
create table if not exists public.connections (
  requester_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  primary key (requester_id, receiver_id)
);

-- ============================================================
-- FULL-TEXT SEARCH column on startups
-- ============================================================
alter table public.startups add column if not exists fts tsvector
  generated always as (
    to_tsvector('english',
      coalesce(name, '') || ' ' ||
      coalesce(tagline, '') || ' ' ||
      coalesce(description, '')
    )
  ) stored;

-- ============================================================
-- RLS — enable on all tables
-- ============================================================
alter table public.profiles enable row level security;
alter table public.startups enable row level security;
alter table public.applications enable row level security;
alter table public.messages enable row level security;
alter table public.notifications enable row level security;
alter table public.saved_startups enable row level security;
alter table public.startup_views enable row level security;
alter table public.connections enable row level security;

-- ============================================================
-- RLS POLICIES
-- ============================================================

-- --- PROFILES: anyone reads, owner writes ---
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

-- --- STARTUPS: published are public, founder manages own ---
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

-- --- APPLICATIONS: applicant + startup founder ---
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

-- --- MESSAGES: sender and receiver only ---
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

-- --- NOTIFICATIONS: target user only ---
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

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
  on public.notifications for insert
  to authenticated
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

-- --- STARTUP VIEWS ---
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

-- --- CONNECTIONS ---
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
-- SIGNUP TRIGGER (auto-create profile)
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    coalesce(new.raw_user_meta_data ->> 'role', 'founder')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('pitch-decks', 'pitch-decks', true)
on conflict (id) do nothing;

drop policy if exists "Avatar images are publicly viewable" on storage.objects;
create policy "Avatar images are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'avatars' or bucket_id = 'pitch-decks');

drop policy if exists "Users can upload their own avatars" on storage.objects;
create policy "Users can upload their own avatars"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'pitch-decks')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update their own avatars" on storage.objects;
create policy "Users can update their own avatars"
  on storage.objects for update
  using (
    bucket_id in ('avatars', 'pitch-decks')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete their own avatars" on storage.objects;
create policy "Users can delete their own avatars"
  on storage.objects for delete
  using (
    bucket_id in ('avatars', 'pitch-decks')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists startups_industry_idx on public.startups (industry);
create index if not exists startups_stage_idx on public.startups (stage);
create index if not exists startups_founder_id_idx on public.startups (founder_id);
create index if not exists startups_updated_at_idx on public.startups (updated_at desc);
create index if not exists startups_fts_idx on public.startups using gin (fts);
create index if not exists applications_startup_id_idx on public.applications (startup_id);
create index if not exists applications_applicant_id_idx on public.applications (applicant_id);
create index if not exists applications_status_idx on public.applications (status);
create index if not exists applications_created_at_idx on public.applications (created_at desc);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_receiver_id_idx on public.messages (receiver_id);
create index if not exists notifications_user_id_idx on public.notifications (user_id);
create index if not exists notifications_created_at_idx on public.notifications (created_at desc);
create index if not exists startup_views_startup_id_idx on public.startup_views (startup_id);
create index if not exists startup_views_viewer_id_idx on public.startup_views (viewer_id);

-- ============================================================
-- SEED DATA (optional — safe to run, no-ops if users missing)
-- ============================================================
insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select u.id, 'Aarav Mehta', 'aaravmehta', 'Building the future of logistics automation. Always looking for sharp minds.', 'founder',
  array['product','strategy','fundraising'], 'India', 'Bengaluru', 8, true
from auth.users u
where u.email = 'aarav@founderhub.app'
on conflict (id) do nothing;

insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select u.id, 'Priya Sharma', 'priyadev', 'Full-stack engineer. React, Python, and systems that scale.', 'developer',
  array['react','typescript','python','fastapi'], 'India', 'Mumbai', 5, true
from auth.users u
where u.email = 'priya@founderhub.app'
on conflict (id) do nothing;

insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select u.id, 'Rohan Verma', 'rohanbuilds', 'Backend engineer specializing in distributed systems and DevOps.', 'developer',
  array['go','kubernetes','aws','postgres'], 'India', 'Pune', 6, true
from auth.users u
where u.email = 'rohan@founderhub.app'
on conflict (id) do nothing;

insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select u.id, 'Sara Khan', 'saraoui', 'Product designer crafting delightful, accessible interfaces.', 'designer',
  array['figma','ui','ux','design-systems'], 'India', 'Delhi', 4, true
from auth.users u
where u.email = 'sara@founderhub.app'
on conflict (id) do nothing;

insert into public.profiles (id, full_name, username, bio, role, skills, country, city, experience_years, is_open_to_work)
select u.id, 'Vikram Nair', 'vikramvc', 'Angel investor focused on AI, SaaS, and deep tech.', 'investor',
  array['diligence','ai','saas','deep-tech'], 'India', 'Bengaluru', 12, true
from auth.users u
where u.email = 'vikram@founderhub.app'
on conflict (id) do nothing;

insert into public.startups (id, founder_id, name, tagline, description, industry, stage, funding_needed, equity_offered, remote_friendly, location, website_url, tech_stack, team_roles_needed, is_published)
select '10000000-0000-0000-0000-000000000001', p.id, 'ShipSwift', 'Logistics automation for modern D2C brands',
  'ShipSwift gives D2C brands a single dashboard to manage carriers, returns, and live tracking across 40+ couriers.',
  'Logistics', 'mvp', '$100K-$500K', 10.00, true, 'Bengaluru, India', 'https://shipswift.in',
  array['react','python','postgres','aws'], array['React Developer','Python Developer'], true
from public.profiles p where p.username = 'aaravmehta'
on conflict (id) do nothing;

insert into public.startups (id, founder_id, name, tagline, description, industry, stage, funding_needed, equity_offered, remote_friendly, location, website_url, tech_stack, team_roles_needed, is_published)
select '10000000-0000-0000-0000-000000000002', p.id, 'MediTrack AI', 'AI triage for rural clinics',
  'MediTrack uses lightweight on-device AI to help rural health workers triage patients and surface high-risk cases first.',
  'HealthTech', 'idea', '$500K+', 12.00, true, 'Mumbai, India', 'https://meditrack.ai',
  array['flutter','tensorflow','fastapi','postgres'], array['Backend Engineer','Data Scientist'], true
from public.profiles p where p.username = 'aaravmehta'
on conflict (id) do nothing;

insert into public.startups (id, founder_id, name, tagline, description, industry, stage, funding_needed, equity_offered, remote_friendly, location, website_url, tech_stack, team_roles_needed, is_published)
select '10000000-0000-0000-0000-000000000003', p.id, 'GreenGrid', 'Peer-to-peer solar energy trading',
  'GreenGrid lets households with solar panels sell surplus energy to neighbours over a blockchain-verified microgrid.',
  'SaaS', 'mvp', '$500K+', 15.00, false, 'Delhi, India', 'https://greengrid.energy',
  array['solidity','react','node','postgres'], array['Backend Engineer','Product Manager'], true
from public.profiles p where p.username = 'aaravmehta'
on conflict (id) do nothing;

insert into public.applications (id, startup_id, applicant_id, role_applying_for, cover_message, status)
select '20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', p.id,
  'React Developer', 'I have built logistics dashboards at scale and would love to own ShipSwift product surface.', 'pending'
from public.profiles p where p.username = 'priyadev'
on conflict (startup_id, applicant_id) do nothing;

insert into public.applications (id, startup_id, applicant_id, role_applying_for, cover_message, status)
select '20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', p.id,
  'Backend Engineer', 'Distributed systems are my bread and butter. Happy to help ShipSwift scale.', 'shortlisted'
from public.profiles p where p.username = 'rohanbuilds'
on conflict (startup_id, applicant_id) do nothing;

insert into public.applications (id, startup_id, applicant_id, role_applying_for, cover_message, status)
select '20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000002', p.id,
  'Product Manager', 'I design health products with empathy. Would love to shape MediTrack workflows.', 'pending'
from public.profiles p where p.username = 'saraoui'
on conflict (startup_id, applicant_id) do nothing;

-- ============================================================
-- DONE
-- ============================================================
