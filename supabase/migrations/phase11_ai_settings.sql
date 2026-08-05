-- FounderHub AI — Phase 11: Multi-provider AI settings & model selector
-- Run in: Supabase Dashboard → SQL Editor (idempotent: safe to run multiple times)

-- 1) AI provider settings per user (encrypted API keys)
create table if not exists public.ai_provider_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  provider text not null check (provider in ('anthropic','openai','openrouter','nvidia')),
  api_key_encrypted text not null,
  selected_model text,
  is_active boolean not null default true,
  last_tested_at timestamptz,
  test_status text not null default 'untested' check (test_status in ('success','failed','untested')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, provider)
);

create index if not exists ai_provider_settings_user_idx on public.ai_provider_settings (user_id);

-- 2) RLS — users manage their own settings
alter table public.ai_provider_settings enable row level security;

drop policy if exists "Users manage own AI settings" on public.ai_provider_settings;
create policy "Users manage own AI settings"
  on public.ai_provider_settings for all
  to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- 3) Preferred provider / model on profiles
alter table public.profiles add column if not exists preferred_ai_provider text not null default 'platform';
alter table public.profiles add column if not exists preferred_ai_model text;
