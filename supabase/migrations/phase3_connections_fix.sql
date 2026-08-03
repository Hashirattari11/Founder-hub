-- ============================================================
-- phase3_connections_fix.sql
-- Idempotent fix for connections:
--  1) ensure connections table + RLS + policies
--  2) keep profiles.connections_count in sync (accepted only)
--  3) NOTIFY the receiver when a pending connection request is created,
--     so the request actually shows up in the receiver's notification bell.
-- Safe to run as-is in the Supabase SQL Editor (even if already applied).
-- ============================================================

-- ------------------------------------------------------------------
-- 1) TABLE + RLS + POLICIES
-- ------------------------------------------------------------------
create table if not exists public.connections (
  requester_id uuid references public.profiles(id) on delete cascade,
  receiver_id uuid references public.profiles(id) on delete cascade,
  status text default 'pending' check (status in ('pending','accepted')),
  created_at timestamptz default now(),
  primary key (requester_id, receiver_id)
);

alter table public.connections enable row level security;

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

-- ------------------------------------------------------------------
-- 2) connections_count SYNC (accepted connections only)
-- ------------------------------------------------------------------
alter table public.profiles add column if not exists connections_count integer default 0;

create or replace function public.sync_connections_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  affected uuid[];
begin
  if tg_op = 'DELETE' then
    affected := array[old.requester_id, old.receiver_id];
  else
    affected := array[new.requester_id, new.receiver_id];
  end if;

  update public.profiles p
  set connections_count = (
    select count(*)
    from public.connections c
    where c.status = 'accepted'
      and (c.requester_id = p.id or c.receiver_id = p.id)
  )
  where p.id = any(affected);

  return null;
end;
$$;

drop trigger if exists sync_connections_count_trigger on public.connections;
create trigger sync_connections_count_trigger
  after insert or update or delete on public.connections
  for each row execute function public.sync_connections_count();

-- Backfill from existing accepted connections
update public.profiles p
set connections_count = (
  select count(*)
  from public.connections c
  where c.status = 'accepted'
    and (c.requester_id = p.id or c.receiver_id = p.id)
);

-- ------------------------------------------------------------------
-- 3) NOTIFICATION to the receiver on a new pending request
--    (security definer -> bypasses RLS so it can insert for receiver)
-- ------------------------------------------------------------------
create or replace function public.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, type, title, body, data)
    select
      new.receiver_id,
      'connection_request',
      'New connection request',
      coalesce(p.full_name, 'Someone') || ' sent you a connection request',
      jsonb_build_object('requester_id', new.requester_id, 'requester_username', p.username)
    from public.profiles p
    where p.id = new.requester_id;
  end if;
  return null;
end;
$$;

drop trigger if exists notify_connection_request_trigger on public.connections;
create trigger notify_connection_request_trigger
  after insert on public.connections
  for each row execute function public.notify_connection_request();
