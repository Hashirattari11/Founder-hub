-- Harden profile ownership: force RLS, block cross-user updates in trigger,
-- and restrict authenticated users to owner-editable columns only.

alter table public.profiles enable row level security;
alter table public.profiles force row level security;

-- Re-assert owner-only write policies (drop stray permissive policies if any).
drop policy if exists "Users can update own profile" on public.profiles;
create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Users can insert own profile" on public.profiles;
create policy "Users can insert own profile"
  on public.profiles for insert
  to authenticated
  with check (auth.uid() = id);

-- Defense-in-depth: reject cross-user writes even if RLS is misconfigured.
create or replace function public.protect_role_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.is_admin is not false
         or new.is_super_admin is not false
         or new.is_verified is not false
         or new.is_premium is not false
         or new.suspended_at is not null
         or new.suspension_reason is not null
         or new.banned_at is not null
         or new.ban_reason is not null
         or new.connections_count <> 0 then
        raise exception 'Privileged and system fields are admin-managed.';
      end if;
      if new.id is distinct from auth.uid() then
        raise exception 'Profile id must match the authenticated user.';
      end if;
      if new.role in ('administrator', 'admin') then
        raise exception 'Administrator role must be granted by an admin.';
      end if;
    else -- UPDATE
      if coalesce(current_setting('founderhub.internal_sync', true), '') = 'connections_count' then
        return new;
      end if;
      if old.id is distinct from auth.uid() then
        raise exception 'You can only update your own profile.';
      end if;
      if new.is_admin is distinct from old.is_admin
         or new.is_super_admin is distinct from old.is_super_admin then
        raise exception 'Admin flags cannot be changed by users.';
      end if;
      if new.is_verified is distinct from old.is_verified
         or new.is_premium is distinct from old.is_premium
         or new.suspended_at is distinct from old.suspended_at
         or new.suspension_reason is distinct from old.suspension_reason
         or new.banned_at is distinct from old.banned_at
         or new.ban_reason is distinct from old.ban_reason then
        raise exception 'Verification, premium and moderation fields are admin-managed.';
      end if;
      if new.connections_count is distinct from old.connections_count
         or new.id is distinct from old.id
         or new.created_at is distinct from old.created_at then
        raise exception 'System fields cannot be changed by users.';
      end if;
      if new.role is distinct from old.role then
        if old.username is not null then
          raise exception 'Role changes require admin approval. Submit a role change request instead.';
        end if;
        if new.role in ('administrator', 'admin') then
          raise exception 'Administrator role must be granted by an admin.';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Least-privilege column grants: owners may edit profile fields only.
revoke update on public.profiles from authenticated;
grant update (
  full_name,
  username,
  avatar_url,
  bio,
  role,
  skills,
  investor_interests,
  country,
  city,
  experience_years,
  linkedin_url,
  github_url,
  portfolio_url,
  twitter_url,
  is_open_to_work,
  investment_range_min,
  investment_range_max,
  investment_stage,
  portfolio_companies,
  notification_preferences,
  preferred_ai_provider,
  preferred_ai_model,
  company,
  location
) on public.profiles to authenticated;

-- Investor profiles: explicit with_check on owner-only writes.
alter table public.investor_profiles enable row level security;
drop policy if exists "Investors manage own profile" on public.investor_profiles;
create policy "Investors manage own profile"
  on public.investor_profiles for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
