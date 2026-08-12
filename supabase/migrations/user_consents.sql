-- Required Terms of Service + Privacy Policy consent per account.

create table if not exists public.user_consents (
  user_id uuid primary key references auth.users(id) on delete cascade,
  terms_accepted boolean not null default false,
  privacy_accepted boolean not null default false,
  accepted_at timestamptz,
  terms_version text not null default '1.0',
  privacy_version text not null default '1.0',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_consents enable row level security;

drop policy if exists "Users can read own consent" on public.user_consents;
create policy "Users can read own consent"
  on public.user_consents for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Users can insert own consent" on public.user_consents;
create policy "Users can insert own consent"
  on public.user_consents for insert
  to authenticated
  with check (
    auth.uid() = user_id
    and terms_accepted is true
    and privacy_accepted is true
  );

drop policy if exists "Users can update own consent" on public.user_consents;
create policy "Users can update own consent"
  on public.user_consents for update
  to authenticated
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and terms_accepted is true
    and privacy_accepted is true
  );

grant select, insert, update on public.user_consents to authenticated;
