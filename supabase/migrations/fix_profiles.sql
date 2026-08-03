-- FounderHub AI — one-time fix script
-- Run in: Supabase Dashboard → SQL Editor
-- Fixes: stale user_id column, wrong trigger, RLS policies using old column

-- 1) Drop any indexes referencing the stale user_id column
drop index if exists profiles_user_id_idx;
drop index if exists profiles_user_id_key;

-- 2) Drop the old trigger before touching columns
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user;

-- 3) Drop the stale user_id column (profiles.id = auth.users.id now)
alter table public.profiles drop column if exists user_id;

-- 4) Recreate the auto-profile trigger (inserts into id, full_name, role)
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Correct RLS policies (using id = auth.uid())
alter table public.profiles enable row level security;

drop policy if exists "Users can read own profile" on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;
drop policy if exists "Profiles are publicly viewable" on public.profiles;

create policy "Profiles are publicly viewable"
  on public.profiles for select
  to anon, authenticated
  using (true);

create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- 6) Delete any orphan rows that don't match a real auth user
delete from public.profiles p
where not exists (select 1 from auth.users u where u.id = p.id);
