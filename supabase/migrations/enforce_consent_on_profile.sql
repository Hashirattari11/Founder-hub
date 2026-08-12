-- Enforce Terms + Privacy consent before profile onboarding (username set).
-- Does not block auth signup or empty profile rows from handle_new_user().

create or replace function public.user_has_valid_consent(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_consents
    where user_id = p_user_id
      and terms_accepted is true
      and privacy_accepted is true
  );
$$;

grant execute on function public.user_has_valid_consent(uuid) to authenticated;

create or replace function public.protect_role_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('founderhub.internal_sync', true), '') = 'connections_count' then
    return new;
  end if;

  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.username is not null
         and not public.user_has_valid_consent(auth.uid()) then
        raise exception 'Terms of Service and Privacy Policy must be accepted before completing your profile.';
      end if;
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
    else
      if new.username is not null
         and old.username is null
         and not public.user_has_valid_consent(auth.uid()) then
        raise exception 'Terms of Service and Privacy Policy must be accepted before completing your profile.';
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
