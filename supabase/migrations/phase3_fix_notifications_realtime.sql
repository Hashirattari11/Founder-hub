-- ============================================================
-- phase3_fix_notifications_realtime.sql
-- Fixes for the "notifications / realtime" issues:
--  1) Notify the other participant (in-app bell) when a message
--     is sent, so messages surface as notifications.
--  2) Make sure all chat/notification tables are in the
--     supabase_realtime publication (live UI updates).
--  3) Set REPLICA IDENTITY FULL so realtime UPDATE events carry
--     the full row.
-- Safe to run as-is in the Supabase SQL Editor (idempotent).
-- ============================================================

-- ------------------------------------------------------------------
-- 1) NEW MESSAGE -> in-app notification for the other participant
-- ------------------------------------------------------------------
create or replace function public.notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other_participant uuid;
  sender_name text;
begin
  select
    case when c.participant_1 = new.sender_id then c.participant_2 else c.participant_1 end
  into other_participant
  from public.chats c
  where c.id = new.chat_id;

  if other_participant is null then
    return null;
  end if;

  select full_name into sender_name from public.profiles where id = new.sender_id;

  insert into public.notifications (user_id, type, title, body, data)
  values (
    other_participant,
    'new_message',
    'New message',
    coalesce(sender_name, 'Someone') || ' sent you a message',
    jsonb_build_object('chat_id', new.chat_id, 'sender_id', new.sender_id)
  );

  return null;
end;
$$;

drop trigger if exists notify_new_message_trigger on public.messages;
create trigger notify_new_message_trigger
  after insert on public.messages
  for each row execute function public.notify_new_message();

-- ------------------------------------------------------------------
-- 2) REALTIME PUBLICATION — ensure every relevant table is included
-- ------------------------------------------------------------------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['chats', 'messages', 'typing_status', 'profiles', 'message_reactions', 'notifications', 'connections']
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

-- ------------------------------------------------------------------
-- 3) REPLICA IDENTITY FULL (realtime UPDATEs carry the full row)
-- ------------------------------------------------------------------
alter table public.messages replica identity full;
alter table public.chats replica identity full;
alter table public.typing_status replica identity full;
alter table public.profiles replica identity full;
alter table public.message_reactions replica identity full;
alter table public.notifications replica identity full;
alter table public.connections replica identity full;

-- ------------------------------------------------------------------
-- Verification (run after the script):
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' order by tablename;
-- ------------------------------------------------------------------
