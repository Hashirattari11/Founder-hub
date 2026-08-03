-- ============================================================
-- PHASE 3 (PART 3/4/5) — chat attachments, reactions, online status
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- STORAGE — chat-images + chat-voices buckets (chat-files already exists)
-- ============================================================
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
-- REALTIME — ensure chats/messages/typing_status/profiles are included
-- (profiles realtime lets the app show online status live)
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
-- INDEXES
-- ============================================================
create index if not exists message_reactions_message_id_idx on public.message_reactions (message_id);
