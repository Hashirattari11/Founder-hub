  -- ============================================================
  -- FOUNDERHUB AI — CHAT & MESSAGING — ALL-IN-ONE migration
  -- Merges: phase3_chat_schema.sql + phase3_chat_part3.sql + phase3_chat_advanced.sql
  -- Fixes: "chats table 404", "profiles is_online/last_seen 400", storage buckets.
  -- Idempotent — safe to re-run. Paste the WHOLE file in Supabase SQL Editor.
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
  -- 4) ONLINE STATUS on profiles  (fixes the profiles 400 error)
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
    )
    with check (
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

  -- ============================================================
  -- STORAGE — chat-files / chat-images / chat-voices buckets
  -- ============================================================
  insert into storage.buckets (id, name, public)
  values ('chat-files', 'chat-files', true)
  on conflict (id) do nothing;

  insert into storage.buckets (id, name, public)
  values ('chat-images', 'chat-images', true)
  on conflict (id) do nothing;

  insert into storage.buckets (id, name, public)
  values ('chat-voices', 'chat-voices', true)
  on conflict (id) do nothing;

  drop policy if exists "Chat files are publicly viewable" on storage.objects;
  create policy "Chat files are publicly viewable"
    on storage.objects for select
    using (bucket_id in ('chat-files', 'chat-images', 'chat-voices', 'avatars', 'pitch-decks'));

  drop policy if exists "Users can upload chat files" on storage.objects;
  create policy "Users can upload chat files"
    on storage.objects for insert
    with check (
      bucket_id in ('chat-files', 'chat-images', 'chat-voices')
      and auth.uid()::text = (storage.foldername(name))[1]
    );

  drop policy if exists "Users can update own chat files" on storage.objects;
  create policy "Users can update own chat files"
    on storage.objects for update
    using (
      bucket_id in ('chat-files', 'chat-images', 'chat-voices')
      and auth.uid()::text = (storage.foldername(name))[1]
    );

  drop policy if exists "Users can delete own chat files" on storage.objects;
  create policy "Users can delete own chat files"
    on storage.objects for delete
    using (
      bucket_id in ('chat-files', 'chat-images', 'chat-voices')
      and auth.uid()::text = (storage.foldername(name))[1]
    );

  -- ============================================================
  -- MESSAGE REACTIONS
  -- ============================================================
  create table if not exists public.message_reactions (
    message_id uuid references public.messages(id) on delete cascade,
    user_id uuid references public.profiles(id) on delete cascade,
    emoji text not null,
    created_at timestamptz default now(),
    primary key (message_id, user_id)
  );

  alter table public.message_reactions enable row level security;

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

  -- ============================================================
  -- REALTIME  (chat list + new messages + typing + online status +
  --            reactions). Placed AFTER all tables exist.
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

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'profiles'
    ) then
      alter publication supabase_realtime add table public.profiles;
    end if;

    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'message_reactions'
    ) then
      alter publication supabase_realtime add table public.message_reactions;
    end if;
  end $$;

  -- ============================================================
  -- WHATSAPP-STYLE MESSAGE COLUMNS
  --    reply_to_id   : quoted message when replying
  --    edited_at     : set when the sender edits a message
  --    is_deleted    : soft-delete "for everyone"
  --    deleted_for   : user ids that soft-deleted "for me"
  --    is_forwarded  : forwarded message flag
  -- ============================================================
  alter table public.messages add column if not exists reply_to_id uuid references public.messages(id) on delete set null;
  alter table public.messages add column if not exists edited_at timestamptz;
  alter table public.messages add column if not exists is_deleted boolean not null default false;
  alter table public.messages add column if not exists deleted_for uuid[] not null default '{}';
  alter table public.messages add column if not exists is_forwarded boolean not null default false;

  -- ============================================================
  -- TAMPER-GUARD — only the sender may change content/edit/delete
  -- for everyone; anyone may only add/remove *themselves* from
  -- deleted_for. Runs on UPDATE so RLS alone can't be abused.
  -- ============================================================
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

  -- ============================================================
  -- INDEXES
  -- ============================================================
  create index if not exists chats_participant_1_idx on public.chats (participant_1);
  create index if not exists chats_participant_2_idx on public.chats (participant_2);
  create index if not exists messages_chat_id_idx on public.messages (chat_id);
  create index if not exists messages_sender_id_idx on public.messages (sender_id);
  create index if not exists messages_chat_id_created_at_idx on public.messages (chat_id, created_at desc);
  create index if not exists messages_reply_to_id_idx on public.messages (reply_to_id);
  create index if not exists message_reactions_message_id_idx on public.message_reactions (message_id);
