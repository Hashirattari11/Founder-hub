-- ============================================================
-- FOUNDERHUB AI — GO LIVE: NOTIFICATIONS + REALTIME (ALL-IN-ONE)
-- ------------------------------------------------------------
-- Jis order mein app kaam karti hai:
--  1) Founder startup publish kare  -> matching users (developer/
--     designer/marketer/investor) ko in-app bell notification
--     (backend /notify-matches se insert hota hai).
--  2) Message bheje                  -> recipient ko in-app bell
--     notification ("New message") trigger se.
--  3) Connection request bheje       -> receiver ko bell
--     notification ("New connection request").
--  4) Accept kare                    -> requester ko "Connection
--     accepted" notification.
--  5) Sab kuch REAL-TIME: notifications, messages, chats, typing,
--     online status, reactions live update hote hain.
--
-- IDEMPOTENT: isse baar-baar run kar sakte ho, koi data loss
-- nahi. Supabase SQL Editor mein POORA file paste karke RUN.
-- ============================================================

-- ============================================================
-- 1) NOTIFICATIONS TABLE + RLS
-- ============================================================
create table if not exists public.notifications (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade,
  type text,
  title text,
  body text,
  data jsonb,
  is_read boolean default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

drop policy if exists "Users can view own notifications" on public.notifications;
create policy "Users can view own notifications"
  on public.notifications for select
  to authenticated
  using (user_id = auth.uid());

drop policy if exists "Users can insert own notifications" on public.notifications;
create policy "Users can insert own notifications"
  on public.notifications for insert
  to authenticated
  with check (user_id = auth.uid());

drop policy if exists "Users can update own notifications" on public.notifications;
create policy "Users can update own notifications"
  on public.notifications for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists notifications_user_id_idx on public.notifications (user_id, created_at desc);

-- ============================================================
-- 2) CHAT SCHEMA (chats / messages / typing_status / reactions)
--    Non-destructive: existing rows preserved.
-- ============================================================
create table if not exists public.chats (
  id uuid default gen_random_uuid() primary key,
  participant_1 uuid references public.profiles(id) on delete cascade,
  participant_2 uuid references public.profiles(id) on delete cascade,
  last_message text,
  last_message_at timestamptz,
  created_at timestamptz default now(),
  unique (participant_1, participant_2)
);

create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  content text,
  type text default 'text',
  file_url text,
  file_name text,
  file_size integer,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- Purane phase-1 messages table ke paas chat_id nahi tha — safe add.
alter table public.messages add column if not exists chat_id uuid references public.chats(id) on delete cascade;
alter table public.messages add column if not exists type text default 'text';
alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists is_deleted boolean not null default false;
alter table public.messages add column if not exists deleted_for uuid[] not null default '{}';
alter table public.messages add column if not exists is_forwarded boolean not null default false;

create table if not exists public.typing_status (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  chat_id uuid references public.chats(id) on delete cascade,
  is_typing boolean default false,
  updated_at timestamptz default now()
);

create table if not exists public.message_reactions (
  message_id uuid references public.messages(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  primary key (message_id, user_id)
);

-- Online status columns on profiles
alter table public.profiles add column if not exists is_online boolean default false;
alter table public.profiles add column if not exists last_seen timestamptz;

-- RLS
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.typing_status enable row level security;
alter table public.message_reactions enable row level security;

drop policy if exists "Chat participants can view chats" on public.chats;
create policy "Chat participants can view chats"
  on public.chats for select
  using (auth.uid() = participant_1 or auth.uid() = participant_2);

drop policy if exists "Chat participants can insert chats" on public.chats;
create policy "Chat participants can insert chats"
  on public.chats for insert
  with check (auth.uid() = participant_1 or auth.uid() = participant_2);

drop policy if exists "Chat participants can update chats" on public.chats;
create policy "Chat participants can update chats"
  on public.chats for update
  using (auth.uid() = participant_1 or auth.uid() = participant_2);

drop policy if exists "Chat participants can view messages" on public.messages;
create policy "Chat participants can view messages"
  on public.messages for select
  using (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
        and (chats.participant_1 = auth.uid() or chats.participant_2 = auth.uid())
    )
  );

drop policy if exists "Sender can insert messages" on public.messages;
create policy "Sender can insert messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

drop policy if exists "Chat participants can update message read state" on public.messages;
create policy "Chat participants can update message read state"
  on public.messages for update
  using (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
        and (chats.participant_1 = auth.uid() or chats.participant_2 = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from public.chats
      where chats.id = messages.chat_id
        and (chats.participant_1 = auth.uid() or chats.participant_2 = auth.uid())
    )
  );

drop policy if exists "Chat participants can view typing status" on public.typing_status;
create policy "Chat participants can view typing status"
  on public.typing_status for select
  using (
    exists (
      select 1 from public.chats
      where chats.id = typing_status.chat_id
        and (chats.participant_1 = auth.uid() or chats.participant_2 = auth.uid())
    )
  );

drop policy if exists "Users can insert own typing status" on public.typing_status;
create policy "Users can insert own typing status"
  on public.typing_status for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can update own typing status" on public.typing_status;
create policy "Users can update own typing status"
  on public.typing_status for update
  using (auth.uid() = user_id);

drop policy if exists "Chat participants can view reactions" on public.message_reactions;
create policy "Chat participants can view reactions"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      join public.chats c on c.id = m.chat_id
      where m.id = message_reactions.message_id
        and (c.participant_1 = auth.uid() or c.participant_2 = auth.uid())
    )
  );

drop policy if exists "Users can insert own reactions" on public.message_reactions;
create policy "Users can insert own reactions"
  on public.message_reactions for insert
  with check (auth.uid() = user_id);

drop policy if exists "Users can delete own reactions" on public.message_reactions;
create policy "Users can delete own reactions"
  on public.message_reactions for delete
  using (auth.uid() = user_id);

-- Chat list "last message" freshness trigger
create or replace function public.touch_chat_last_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.chats
  set last_message = coalesce(new.content, 'Attachment'),
      last_message_at = new.created_at
  where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.touch_chat_last_message();

-- Tamper guard: sirf sender apna message edit/delete kar sakta hai
create or replace function public.prevent_message_tampering()
returns trigger
language plpgsql
security definer
as $$
declare
  added_ok boolean;
  removed_ok boolean;
begin
  if (
    new.content is distinct from old.content
    or new.is_deleted is distinct from old.is_deleted
    or new.edited_at is distinct from old.edited_at
    or new.is_forwarded is distinct from old.is_forwarded
    or new.reply_to_id is distinct from old.reply_to_id
    or new.type is distinct from old.type
    or new.sender_id is distinct from old.sender_id
    or new.file_url is distinct from old.file_url
    or new.file_name is distinct from old.file_name
    or new.file_size is distinct from old.file_size
  ) and auth.uid() <> old.sender_id then
    raise exception 'Only the message sender can modify this message';
  end if;

  if new.deleted_for is distinct from old.deleted_for then
    select coalesce(bool_and(n = auth.uid() or n = any(old.deleted_for)), true)
      into added_ok from unnest(new.deleted_for) n;
    select coalesce(bool_and(o = auth.uid() or o = any(new.deleted_for)), true)
      into removed_ok from unnest(old.deleted_for) o;
    if not (added_ok and removed_ok) then
      raise exception 'You may only add or remove yourself from deleted_for';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists on_message_update on public.messages;
create trigger on_message_update
  before update on public.messages
  for each row execute function public.prevent_message_tampering();

create index if not exists chats_participant_1_idx on public.chats (participant_1);
create index if not exists chats_participant_2_idx on public.chats (participant_2);
create index if not exists messages_chat_id_idx on public.messages (chat_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_chat_id_created_at_idx on public.messages (chat_id, created_at desc);
create index if not exists messages_reply_to_id_idx on public.messages (reply_to_id);
create index if not exists message_reactions_message_id_idx on public.message_reactions (message_id);

-- ============================================================
-- 3) CONNECTIONS TABLE + RLS + NOTIFICATIONS
-- ============================================================
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

-- connections_count in sync (accepted only)
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

update public.profiles p
set connections_count = (
  select count(*) from public.connections c
  where c.status = 'accepted' and (c.requester_id = p.id or c.receiver_id = p.id)
);

-- 3a) REQUEST SENT -> receiver ko in-app notification (LinkedIn-style)
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

-- 3b) REQUEST ACCEPTED -> requester ko notification
create or replace function public.notify_connection_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, type, title, body, data)
    select
      new.requester_id,
      'connection_request',
      'Connection accepted',
      coalesce(p.full_name, 'Someone') || ' accepted your connection request',
      jsonb_build_object('requester_id', new.receiver_id, 'requester_username', p.username)
    from public.profiles p
    where p.id = new.receiver_id;
  end if;
  return null;
end;
$$;

drop trigger if exists notify_connection_accepted_trigger on public.connections;
create trigger notify_connection_accepted_trigger
  after update on public.connections
  for each row execute function public.notify_connection_accepted();

-- ============================================================
-- 4) NEW MESSAGE -> recipient ko in-app notification
-- ============================================================
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

-- ============================================================
-- 5) REALTIME PUBLICATION — sab tables live update ke liye
-- ============================================================
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

-- ============================================================
-- 6) REPLICA IDENTITY FULL — realtime UPDATE events me full row
-- ============================================================
alter table public.messages replica identity full;
alter table public.chats replica identity full;
alter table public.typing_status replica identity full;
alter table public.profiles replica identity full;
alter table public.message_reactions replica identity full;
alter table public.notifications replica identity full;
alter table public.connections replica identity full;

-- ============================================================
-- VERIFY (SQL Editor me yeh run karke dekho):
--   select tablename from pg_publication_tables
--   where pubname = 'supabase_realtime' order by tablename;
--   7 tables dikhni chahiye: chats, connections, message_reactions,
--   messages, notifications, profiles, typing_status.
-- ============================================================
