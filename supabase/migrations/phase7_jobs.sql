-- =====================================================================
-- Phase 7 - Jobs & Hiring System
-- Tables: jobs, job_applications, resumes, saved_jobs, job_alerts
-- =====================================================================

-- ---------- JOBS ----------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  startup_id uuid references public.startups(id) on delete cascade,
  posted_by uuid references public.profiles(id) on delete cascade,
  title text not null,
  description text not null,
  requirements text[],
  nice_to_have text[],
  job_type text check (job_type in ('full_time','part_time','remote','internship','contract','freelance')),
  location text,
  is_remote boolean default false,
  salary_min integer,
  salary_max integer,
  salary_currency text default 'USD',
  equity_offered numeric(5,2),
  experience_level text check (experience_level in ('entry','mid','senior','lead')),
  skills_required text[],
  industry text,
  application_deadline timestamptz,
  is_active boolean default true,
  views_count integer default 0,
  applications_count integer default 0,
  created_at timestamptz default now()
);

create index if not exists jobs_startup_id_idx on public.jobs(startup_id);
create index if not exists jobs_created_at_idx on public.jobs(created_at desc);

-- ---------- JOB APPLICATIONS ----------
create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_id uuid references public.jobs(id) on delete cascade,
  applicant_id uuid references public.profiles(id) on delete cascade,
  cover_letter text,
  resume_url text,
  portfolio_url text,
  expected_salary integer,
  availability text,
  status text default 'pending' check (status in ('pending','reviewing','shortlisted','interview','accepted','rejected')),
  notes text,
  created_at timestamptz default now(),
  unique (job_id, applicant_id)
);

create index if not exists job_applications_job_id_idx on public.job_applications(job_id);
create index if not exists job_applications_applicant_id_idx on public.job_applications(applicant_id);

-- ---------- RESUMES ----------
create table if not exists public.resumes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  title text,
  content jsonb,
  pdf_url text,
  is_default boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ---------- SAVED JOBS ----------
create table if not exists public.saved_jobs (
  user_id uuid references public.profiles(id) on delete cascade,
  job_id uuid references public.jobs(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, job_id)
);

-- ---------- JOB ALERTS ----------
create table if not exists public.job_alerts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  keywords text[],
  job_types text[],
  location text,
  min_salary integer,
  experience_level text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- ---------- RLS ENABLE ----------
alter table public.jobs enable row level security;
alter table public.job_applications enable row level security;
alter table public.resumes enable row level security;
alter table public.saved_jobs enable row level security;
alter table public.job_alerts enable row level security;

-- ---------- JOBS POLICIES ----------
drop policy if exists "Anyone can view active jobs" on public.jobs;
create policy "Anyone can view active jobs"
  on public.jobs for select
  using (is_active = true);

drop policy if exists "Founders view own jobs" on public.jobs;
create policy "Founders view own jobs"
  on public.jobs for select
  using (auth.uid() = posted_by);

drop policy if exists "Founders can insert jobs" on public.jobs;
create policy "Founders can insert jobs"
  on public.jobs for insert
  with check (auth.uid() = posted_by);

drop policy if exists "Founders can update own jobs" on public.jobs;
create policy "Founders can update own jobs"
  on public.jobs for update
  using (auth.uid() = posted_by)
  with check (auth.uid() = posted_by);

drop policy if exists "Founders can delete own jobs" on public.jobs;
create policy "Founders can delete own jobs"
  on public.jobs for delete
  using (auth.uid() = posted_by);

-- ---------- JOB APPLICATIONS POLICIES ----------
drop policy if exists "Applicants view own applications" on public.job_applications;
create policy "Applicants view own applications"
  on public.job_applications for select
  using (auth.uid() = applicant_id);

drop policy if exists "Job poster views applications" on public.job_applications;
create policy "Job poster views applications"
  on public.job_applications for select
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_applications.job_id
        and jobs.posted_by = auth.uid()
    )
  );

drop policy if exists "Users can apply" on public.job_applications;
create policy "Users can apply"
  on public.job_applications for insert
  with check (auth.uid() = applicant_id);

drop policy if exists "Applicants withdraw own applications" on public.job_applications;
create policy "Applicants withdraw own applications"
  on public.job_applications for delete
  using (auth.uid() = applicant_id);

drop policy if exists "Job poster updates status" on public.job_applications;
create policy "Job poster updates status"
  on public.job_applications for update
  using (
    exists (
      select 1 from public.jobs
      where jobs.id = job_applications.job_id
        and jobs.posted_by = auth.uid()
    )
  );

-- ---------- RESUMES POLICIES ----------
drop policy if exists "Users manage own resumes" on public.resumes;
create policy "Users manage own resumes"
  on public.resumes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- SAVED JOBS POLICIES ----------
drop policy if exists "Anyone can view saved jobs" on public.saved_jobs;
create policy "Anyone can view saved jobs"
  on public.saved_jobs for select
  using (true);

drop policy if exists "Users manage own saved jobs" on public.saved_jobs;
create policy "Users manage own saved jobs"
  on public.saved_jobs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- JOB ALERTS POLICIES ----------
drop policy if exists "Users manage own alerts" on public.job_alerts;
create policy "Users manage own alerts"
  on public.job_alerts for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ---------- APPLICATIONS_COUNT TRIGGER ----------
create or replace function public.sync_job_applications_count()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' then
    update public.jobs
    set applications_count = applications_count + 1
    where id = new.job_id;
  elsif tg_op = 'DELETE' then
    update public.jobs
    set applications_count = greatest(applications_count - 1, 0)
    where id = old.job_id;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists sync_job_applications_count_trigger on public.job_applications;
create trigger sync_job_applications_count_trigger
  after insert or delete on public.job_applications
  for each row execute function public.sync_job_applications_count();

-- ---------- REALTIME ----------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['jobs', 'job_applications']
  loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = tbl
    ) then
      execute format('alter publication supabase_realtime add table public.%I;', tbl);
    end if;
  end loop;
end $$;

alter table public.jobs replica identity full;
alter table public.job_applications replica identity full;

-- ---------- STORAGE BUCKET (resumes) ----------
insert into storage.buckets (id, name, public)
select 'resumes', 'resumes', true
where not exists (select 1 from storage.buckets where id = 'resumes');

update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['application/pdf']
where id = 'resumes';

drop policy if exists "Users upload own resumes" on storage.objects;
create policy "Users upload own resumes"
  on storage.objects for insert
  to authenticated
  with check (auth.role() = 'authenticated' and bucket_id = 'resumes');

drop policy if exists "Public can view resumes" on storage.objects;
create policy "Public can view resumes"
  on storage.objects for select
  using (bucket_id = 'resumes');

drop policy if exists "Users delete own resumes" on storage.objects;
create policy "Users delete own resumes"
  on storage.objects for delete
  using (bucket_id = 'resumes' and auth.uid()::text = owner_id);
