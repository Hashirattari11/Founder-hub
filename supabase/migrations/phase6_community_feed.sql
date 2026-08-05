-- =============================================================
-- Phase 6: Social Community Feed (LinkedIn + Twitter style)
-- Idempotent — safe to re-run. Statement-wise safe in SQL Editor.
-- =============================================================

-- ---------- POSTS ----------
create table if not exists public.posts (
  id uuid default gen_random_uuid() primary key,
  author_id uuid not null references public.profiles(id) on delete cascade,
  startup_id uuid references public.startups(id) on delete set null,
  content text not null,
  media_urls text[],
  post_type text default 'update' check (post_type in ('update','milestone','question','hiring','funding','launch')),
  hashtags text[],
  is_pinned boolean default false,
  repost_of uuid references public.posts(id) on delete set null,
  views_count integer default 0,
  likes_count integer default 0,
  comments_count integer default 0,
  reposts_count integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists posts_author_id_idx on public.posts (author_id);
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_repost_of_idx on public.posts (repost_of);
create index if not exists posts_hashtags_idx on public.posts using gin (hashtags);
create index if not exists posts_post_type_idx on public.posts (post_type);

-- ---------- POST LIKES ----------
create table if not exists public.post_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

-- ---------- POST COMMENTS ----------
create table if not exists public.post_comments (
  id uuid default gen_random_uuid() primary key,
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  content text not null,
  parent_comment_id uuid references public.post_comments(id) on delete cascade,
  likes_count integer default 0,
  created_at timestamptz default now()
);

create index if not exists post_comments_post_id_idx on public.post_comments (post_id, created_at);
create index if not exists post_comments_author_id_idx on public.post_comments (author_id);

-- ---------- COMMENT LIKES ----------
create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  comment_id uuid not null references public.post_comments(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, comment_id)
);

-- ---------- HASHTAGS ----------
create table if not exists public.hashtags (
  id uuid default gen_random_uuid() primary key,
  name text unique not null,
  posts_count integer default 0,
  created_at timestamptz default now()
);

create index if not exists hashtags_posts_count_idx on public.hashtags (posts_count desc);

-- ---------- POST HASHTAGS JUNCTION ----------
create table if not exists public.post_hashtags (
  post_id uuid references public.posts(id) on delete cascade,
  hashtag_id uuid references public.hashtags(id) on delete cascade,
  primary key (post_id, hashtag_id)
);

-- ---------- BOOKMARKS ----------
create table if not exists public.post_bookmarks (
  user_id uuid references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, post_id)
);

create index if not exists post_bookmarks_user_id_idx on public.post_bookmarks (user_id, created_at desc);

-- ---------- HASHTAG FOLLOWS ----------
create table if not exists public.hashtag_follows (
  user_id uuid references public.profiles(id) on delete cascade,
  hashtag_id uuid references public.hashtags(id) on delete cascade,
  created_at timestamptz default now(),
  primary key (user_id, hashtag_id)
);

-- ---------- RLS ----------
alter table public.posts enable row level security;
alter table public.post_likes enable row level security;
alter table public.post_comments enable row level security;
alter table public.comment_likes enable row level security;
alter table public.hashtags enable row level security;
alter table public.post_hashtags enable row level security;
alter table public.post_bookmarks enable row level security;
alter table public.hashtag_follows enable row level security;

drop policy if exists "Anyone can view posts" on public.posts;
create policy "Anyone can view posts"
  on public.posts for select
  using (true);

drop policy if exists "Users can insert own posts" on public.posts;
create policy "Users can insert own posts"
  on public.posts for insert
  with check (auth.uid() = author_id);

drop policy if exists "Users can update own posts" on public.posts;
create policy "Users can update own posts"
  on public.posts for update
  using (auth.uid() = author_id);

drop policy if exists "Users can delete own posts" on public.posts;
create policy "Users can delete own posts"
  on public.posts for delete
  using (auth.uid() = author_id);

drop policy if exists "Anyone can view likes" on public.post_likes;
create policy "Anyone can view likes"
  on public.post_likes for select
  using (true);

drop policy if exists "Users manage own likes" on public.post_likes;
create policy "Users manage own likes"
  on public.post_likes for all
  using (auth.uid() = user_id);

drop policy if exists "Anyone can view comments" on public.post_comments;
create policy "Anyone can view comments"
  on public.post_comments for select
  using (true);

drop policy if exists "Users can insert comments" on public.post_comments;
create policy "Users can insert comments"
  on public.post_comments for insert
  with check (auth.uid() = author_id);

drop policy if exists "Users can delete own comments" on public.post_comments;
create policy "Users can delete own comments"
  on public.post_comments for delete
  using (auth.uid() = author_id);

drop policy if exists "Anyone can view comment likes" on public.comment_likes;
create policy "Anyone can view comment likes"
  on public.comment_likes for select
  using (true);

drop policy if exists "Users manage own comment likes" on public.comment_likes;
create policy "Users manage own comment likes"
  on public.comment_likes for all
  using (auth.uid() = user_id);

drop policy if exists "Anyone can view hashtags" on public.hashtags;
create policy "Anyone can view hashtags"
  on public.hashtags for select
  using (true);

drop policy if exists "Anyone can view post hashtags" on public.post_hashtags;
create policy "Anyone can view post hashtags"
  on public.post_hashtags for select
  using (true);

drop policy if exists "Anyone can view bookmarks" on public.post_bookmarks;
create policy "Anyone can view bookmarks"
  on public.post_bookmarks for select
  using (true);

drop policy if exists "Users manage own bookmarks" on public.post_bookmarks;
create policy "Users manage own bookmarks"
  on public.post_bookmarks for all
  using (auth.uid() = user_id);

drop policy if exists "Anyone can view hashtag follows" on public.hashtag_follows;
create policy "Anyone can view hashtag follows"
  on public.hashtag_follows for select
  using (true);

drop policy if exists "Users manage own hashtag follows" on public.hashtag_follows;
create policy "Users manage own hashtag follows"
  on public.hashtag_follows for all
  using (auth.uid() = user_id);

-- ---------- COUNT TRIGGERS (single source of truth) ----------
create or replace function public.sync_post_likes_count()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.posts
  set likes_count = (select count(*) from public.post_likes where post_id = coalesce(new.post_id, old.post_id))
  where id = coalesce(new.post_id, old.post_id);
  return null;
end $$;

drop trigger if exists sync_post_likes_count_trigger on public.post_likes;
create trigger sync_post_likes_count_trigger
  after insert or delete on public.post_likes
  for each row execute function public.sync_post_likes_count();

create or replace function public.sync_post_comments_count()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update public.posts
  set comments_count = (select count(*) from public.post_comments where post_id = coalesce(new.post_id, old.post_id))
  where id = coalesce(new.post_id, old.post_id);
  return null;
end $$;

drop trigger if exists sync_post_comments_count_trigger on public.post_comments;
create trigger sync_post_comments_count_trigger
  after insert or delete on public.post_comments
  for each row execute function public.sync_post_comments_count();

create or replace function public.sync_post_reposts_count()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  target uuid;
begin
  target := coalesce(new.repost_of, old.repost_of);
  if target is not null then
    update public.posts
    set reposts_count = (select count(*) from public.posts where repost_of = target)
    where id = target;
  end if;
  return null;
end $$;

drop trigger if exists sync_post_reposts_count_trigger on public.posts;
create trigger sync_post_reposts_count_trigger
  after insert or delete on public.posts
  for each row execute function public.sync_post_reposts_count();

-- ---------- HASHTAG SYNC TRIGGER ----------
create or replace function public.sync_post_hashtags()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  tag text;
  tag_id uuid;
  affected_names text[];
begin
  if tg_op <> 'INSERT' and old.hashtags is not null then
    affected_names := old.hashtags;
  end if;

  delete from public.post_hashtags
  where post_id = coalesce(old.id, new.id);

  if tg_op <> 'DELETE' and new.hashtags is not null then
    affected_names := coalesce(affected_names, '{}') || new.hashtags;
    foreach tag in array new.hashtags
    loop
      insert into public.hashtags (name) values (tag)
      on conflict (name) do update set name = excluded.name
      returning id into tag_id;
      insert into public.post_hashtags (post_id, hashtag_id)
      values (new.id, tag_id)
      on conflict do nothing;
    end loop;
  end if;

  if affected_names is not null then
    update public.hashtags h
    set posts_count = (select count(*) from public.post_hashtags ph where ph.hashtag_id = h.id)
    where h.name = any (affected_names);
  end if;

  return null;
end $$;

drop trigger if exists sync_post_hashtags_trigger on public.posts;
create trigger sync_post_hashtags_trigger
  after insert or update of hashtags or delete on public.posts
  for each row execute function public.sync_post_hashtags();

-- ---------- NOTIFICATION RPC (insert for other users w/ RLS intact) ----------
create or replace function public.create_notification(
  p_user_id uuid,
  p_type text,
  p_title text,
  p_body text,
  p_data jsonb default '{}'::jsonb
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  nid uuid;
begin
  if p_user_id is null then
    return null;
  end if;
  insert into public.notifications (user_id, type, title, body, data)
  values (p_user_id, p_type, p_title, p_body, p_data)
  returning id into nid;
  return nid;
end $$;

revoke all on function public.create_notification(uuid, text, text, text, jsonb) from public;
grant execute on function public.create_notification(uuid, text, text, text, jsonb) to authenticated;

-- ---------- REALTIME ----------
do $$
declare
  tbl text;
begin
  foreach tbl in array array['posts', 'post_likes', 'post_comments']
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

alter table public.posts replica identity full;
alter table public.post_likes replica identity full;
alter table public.post_comments replica identity full;

-- ---------- STORAGE BUCKET (post-media) ----------
insert into storage.buckets (id, name, public)
select 'post-media', 'post-media', true
where not exists (select 1 from storage.buckets where id = 'post-media');

update storage.buckets
set file_size_limit = 10485760,
    allowed_mime_types = array['image/*','video/*']
where id = 'post-media';

drop policy if exists "Auth users can upload post media" on storage.objects;
create policy "Auth users can upload post media"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'post-media');

drop policy if exists "Public can view post media" on storage.objects;
create policy "Public can view post media"
  on storage.objects for select
  using (bucket_id = 'post-media');
