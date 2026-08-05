-- FounderHub AI — Phase 10: device push tokens
-- Run in: Supabase Dashboard → SQL Editor (idempotent: safe to run multiple times)

-- 1) push_tokens table
create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('ios','android','web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists push_tokens_user_id_idx on public.push_tokens (user_id);
create index if not exists push_tokens_token_idx on public.push_tokens (token);

-- 2) RLS
alter table public.push_tokens enable row level security;

-- Users can read their own tokens
drop policy if exists "Users can read own push tokens" on public.push_tokens;
create policy "Users can read own push tokens"
  on public.push_tokens for select
  to authenticated
  using (auth.uid() = user_id);

-- Users can register their own tokens
drop policy if exists "Users can insert own push tokens" on public.push_tokens;
create policy "Users can insert own push tokens"
  on public.push_tokens for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Users can delete their own tokens (sign out / reinstall cleanup)
drop policy if exists "Users can delete own push tokens" on public.push_tokens;
create policy "Users can delete own push tokens"
  on public.push_tokens for delete
  to authenticated
  using (auth.uid() = user_id);

-- 3) Keep updated_at fresh on upsert
create or replace function public.touch_push_token()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists push_tokens_touch on public.push_tokens;
create trigger push_tokens_touch
  before update on public.push_tokens
  for each row execute function public.touch_push_token();
