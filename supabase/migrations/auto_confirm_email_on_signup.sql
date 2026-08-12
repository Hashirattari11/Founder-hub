-- Auto-confirm emails so register → immediate login without verification mail.
-- Equivalent to disabling "Confirm email" in Supabase Auth settings.

create or replace function public.auto_confirm_auth_user()
returns trigger
language plpgsql
security definer
set search_path = auth, public
as $$
begin
  update auth.users
  set email_confirmed_at = coalesce(email_confirmed_at, now())
  where id = new.id;
  return new;
end;
$$;

drop trigger if exists on_auth_user_auto_confirm on auth.users;
create trigger on_auth_user_auto_confirm
  after insert on auth.users
  for each row
  execute function public.auto_confirm_auth_user();

-- Confirm any existing accounts still waiting on email verification.
update auth.users
set email_confirmed_at = coalesce(email_confirmed_at, now())
where email_confirmed_at is null;
