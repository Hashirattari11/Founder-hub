-- ============================================================
-- phase3_profile_stats.sql
-- Real profile stats: maintain profiles.connections_count via a
-- trigger so profile pages show real "Connections" numbers without
-- exposing the private connection graph.
-- Run AFTER phase3_chat_schema.sql / part3 / advanced.
-- ============================================================

alter table public.profiles add column if not exists connections_count integer default 0;

-- ------------------------------------------------------------------
-- Trigger: keep profiles.connections_count in sync with accepted
-- connections whenever a connection row is inserted/updated/deleted.
-- security definer so the count subquery is not blocked by RLS.
-- ------------------------------------------------------------------
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
