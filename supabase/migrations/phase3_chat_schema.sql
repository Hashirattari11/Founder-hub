-- ============================================================
-- PHASE 3 — CHAT & MESSAGING (idempotent, safe to re-run)
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- The old phase-1 `messages` table (sender_id/receiver_id, never used by the
-- app) is dropped so we can rebuild it for the chat model.
drop table if exists public.messages cascade;

-- ============================================================
-- 1) CHATS  (a conversation between 2 users)
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

-- ============================================================
-- 2) MESSAGES
-- ============================================================
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  chat_id uuid references public.chats(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade,
  content text,
  type text default 'text' check (type in ('text','image','file','voice')),
  file_url text,
  file_name text,
  file_size integer,
  is_read boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- 3) TYPING STATUS  (ephemeral)
-- ============================================================
create table if not exists public.typing_status (
  user_id uuid references public.profiles(id) on delete cascade primary key,
  chat_id uuid references public.chats(id) on delete cascade,
  is_typing boolean default false,
  updated_at timestamptz default now()
);

-- ============================================================
-- 4) ONLINE STATUS on profiles
-- ============================================================
alter table public.profiles add column if not exists is_online boolean default false;
alter table public.profiles add column if not exists last_seen timestamptz;

-- ============================================================
-- RLS — enable
-- ============================================================
alter table public.chats enable row level security;
alter table public.messages enable row level security;
alter table public.typing_status enable row level security;

-- ============================================================
-- CHATS POLICIES
-- ============================================================
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

-- ============================================================
-- MESSAGES POLICIES
-- ============================================================
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
  );

-- ============================================================
-- TYPING STATUS POLICIES
-- ============================================================
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

-- ============================================================
-- TRIGGER — keep chat.last_message / last_message_at fresh
-- ============================================================
create or replace function public.touch_chat_last_message()
returns trigger
language plpgsql
security definer
as $$
begin
  update public.chats
  set last_message = new.content,
      last_message_at = new.created_at
  where id = new.chat_id;
  return new;
end;
$$;

drop trigger if exists on_message_insert on public.messages;
create trigger on_message_insert
  after insert on public.messages
  for each row execute function public.touch_chat_last_message();

-- ============================================================
-- REALTIME  (chat list + new messages + typing)
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chats'
  ) then
    alter publication supabase_realtime add table public.chats;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'typing_status'
  ) then
    alter publication supabase_realtime add table public.typing_status;
  end if;
end $$;

-- ============================================================
-- STORAGE — chat-files bucket
-- ============================================================
insert into storage.buckets (id, name, public)
values ('chat-files', 'chat-files', true)
on conflict (id) do nothing;

drop policy if exists "Chat files are publicly viewable" on storage.objects;
create policy "Chat files are publicly viewable"
  on storage.objects for select
  using (bucket_id = 'chat-files' or bucket_id = 'avatars' or bucket_id = 'pitch-decks');

drop policy if exists "Users can upload chat files" on storage.objects;
create policy "Users can upload chat files"
  on storage.objects for insert
  with check (
    bucket_id in ('avatars', 'pitch-decks', 'chat-files')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can update own chat files" on storage.objects;
create policy "Users can update own chat files"
  on storage.objects for update
  using (
    bucket_id in ('avatars', 'pitch-decks', 'chat-files')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists "Users can delete own chat files" on storage.objects;
create policy "Users can delete own chat files"
  on storage.objects for delete
  using (
    bucket_id in ('avatars', 'pitch-decks', 'chat-files')
    and auth.uid()::text = (storage.foldername(name))[1]
  );

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists chats_participant_1_idx on public.chats (participant_1);
create index if not exists chats_participant_2_idx on public.chats (participant_2);
create index if not exists messages_chat_id_idx on public.messages (chat_id);
create index if not exists messages_sender_id_idx on public.messages (sender_id);
create index if not exists messages_chat_id_created_at_idx on public.messages (chat_id, created_at desc);
