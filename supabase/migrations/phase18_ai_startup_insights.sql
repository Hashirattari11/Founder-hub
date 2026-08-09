-- FounderHub Phase 18: AI Startup Insights + Explainable Matching
-- Idempotent — safe to run multiple times.
-- Adds: startup_health_scores, team_gap_analysis, investor_readiness_scores, ai_matches
-- All analyses are data-driven (no fabricated data); JSONB payloads carry per-category
-- breakdowns, reasons, data coverage and provider so the UI stays explainable.

-- ============================================================
-- 1) startup_health_scores
--    One cached health analysis per startup (Analyze Again = upsert).
-- ============================================================
create table if not exists public.startup_health_scores (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  categories jsonb not null default '[]'::jsonb,        -- [{key,label,score,max,note}]
  strengths jsonb not null default '[]'::jsonb,         -- [{title,detail}]
  weaknesses jsonb not null default '[]'::jsonb,        -- [{title,detail,impact}]
  recommendations jsonb not null default '[]'::jsonb,   -- [{action,priority}]
  summary text not null default '',
  data_coverage jsonb not null default '{}'::jsonb,     -- {available:[...],missing:[...],insufficient:bool}
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint startup_health_scores_startup_key unique (startup_id)
);

create index if not exists startup_health_scores_user_idx
  on public.startup_health_scores (user_id);

alter table public.startup_health_scores enable row level security;

drop policy if exists "Health: founder/owner can manage own" on public.startup_health_scores;
create policy "Health: founder/owner can manage own"
  on public.startup_health_scores for all to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = auth.uid())
  );

drop policy if exists "Health: admins read all" on public.startup_health_scores;
create policy "Health: admins read all"
  on public.startup_health_scores for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ============================================================
-- 2) team_gap_analysis
--    One cached team-gap analysis per startup.
-- ============================================================
create table if not exists public.team_gap_analysis (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  summary text not null default '',
  present_roles jsonb not null default '[]'::jsonb,     -- [{role,member_count}]
  gaps jsonb not null default '[]'::jsonb,              -- [{role,criticality,why,suggested_skills[],responsibilities[],next_action,priority}]
  data_coverage jsonb not null default '{}'::jsonb,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_gap_analysis_startup_key unique (startup_id)
);

alter table public.team_gap_analysis enable row level security;

drop policy if exists "Gaps: founder/owner can manage own" on public.team_gap_analysis;
create policy "Gaps: founder/owner can manage own"
  on public.team_gap_analysis for all to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = auth.uid())
  );

drop policy if exists "Gaps: admins read all" on public.team_gap_analysis;
create policy "Gaps: admins read all"
  on public.team_gap_analysis for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ============================================================
-- 3) investor_readiness_scores
--    One cached investor-readiness score per startup.
-- ============================================================
create table if not exists public.investor_readiness_scores (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  score integer not null check (score between 0 and 100),
  categories jsonb not null default '[]'::jsonb,        -- [{key,label,score,max,note}]
  strengths jsonb not null default '[]'::jsonb,
  weaknesses jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,         -- [{item,done,category}]
  summary text not null default '',
  data_coverage jsonb not null default '{}'::jsonb,
  provider text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint investor_readiness_scores_startup_key unique (startup_id)
);

create index if not exists investor_readiness_scores_user_idx
  on public.investor_readiness_scores (user_id);

alter table public.investor_readiness_scores enable row level security;

drop policy if exists "Readiness: founder/owner can manage own" on public.investor_readiness_scores;
create policy "Readiness: founder/owner can manage own"
  on public.investor_readiness_scores for all to authenticated
  using (
    auth.uid() = user_id
    or exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = auth.uid())
  )
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = auth.uid())
  );

drop policy if exists "Readiness: admins read all" on public.investor_readiness_scores;
create policy "Readiness: admins read all"
  on public.investor_readiness_scores for select to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));

-- ============================================================
-- 4) ai_matches (explainable matches: score + per-factor reasons)
--    One row per (startup, matched user, role) — regenerating upserts.
-- ============================================================
create table if not exists public.ai_matches (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid not null references public.startups(id) on delete cascade,
  target_user_id uuid not null references public.profiles(id) on delete cascade,
  role text,                                            -- investor | developer | designer | marketer | ...
  score integer not null check (score between 0 and 100),
  scores jsonb not null default '[]'::jsonb,            -- [{category,label,weight,score,max,note}]
  reasons jsonb not null default '[]'::jsonb,           -- [{factor,detail,weight,contribution}]
  concerns jsonb not null default '[]'::jsonb,          -- [{factor,detail}]
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ai_matches_unique unique (startup_id, target_user_id, role)
);

create index if not exists ai_matches_target_user_idx
  on public.ai_matches (target_user_id, score desc);
create index if not exists ai_matches_startup_idx
  on public.ai_matches (startup_id);

alter table public.ai_matches enable row level security;

drop policy if exists "Matches: matched user reads own" on public.ai_matches;
create policy "Matches: matched user reads own"
  on public.ai_matches for select to authenticated
  using (auth.uid() = target_user_id);

drop policy if exists "Matches: founder reads own startup matches" on public.ai_matches;
create policy "Matches: founder reads own startup matches"
  on public.ai_matches for select to authenticated
  using (exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = auth.uid()));

drop policy if exists "Matches: founder creates for own startup" on public.ai_matches;
create policy "Matches: founder creates for own startup"
  on public.ai_matches for insert to authenticated
  with check (exists (select 1 from public.startups s where s.id = startup_id and s.founder_id = auth.uid()));

drop policy if exists "Matches: admins manage all" on public.ai_matches;
create policy "Matches: admins manage all"
  on public.ai_matches for all to authenticated
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_admin = true));
