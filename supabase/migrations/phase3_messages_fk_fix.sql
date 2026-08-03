-- ============================================================
-- phase3_messages_fk_fix.sql
-- Fixes: "Could not find a relationship between 'messages' and
-- 'messages' ... messages_reply_to_id_fkey"
--  1) ensure all WhatsApp-style columns exist on messages
--  2) ensure the self-referential FK messages.reply_to_id -> messages.id
--  3) reload PostgREST's schema cache so it sees the relationship
-- Safe to run as-is in the Supabase SQL Editor (idempotent).
-- ============================================================

-- ------------------------------------------------------------------
-- 1) COLUMNS (no-op if already present)
-- ------------------------------------------------------------------
alter table public.messages add column if not exists reply_to_id uuid;
alter table public.messages add column if not exists edited_at timestamptz;
alter table public.messages add column if not exists is_deleted boolean not null default false;
alter table public.messages add column if not exists deleted_for uuid[] not null default '{}';
alter table public.messages add column if not exists is_forwarded boolean not null default false;

-- ------------------------------------------------------------------
-- 2) SELF-REFERENTIAL FK (by column, so it works whatever the name)
-- ------------------------------------------------------------------
do $$
declare
  col_attnum smallint;
begin
  select a.attnum into col_attnum
  from pg_attribute a
  where a.attrelid = 'public.messages'::regclass
    and a.attname = 'reply_to_id';

  if col_attnum is not null and not exists (
    select 1
    from pg_constraint c
    where c.conrelid = 'public.messages'::regclass
      and c.contype = 'f'
      and c.conkey = array[col_attnum]
      and c.confrelid = 'public.messages'::regclass
  ) then
    execute 'alter table public.messages
      add constraint messages_reply_to_id_fkey
      foreign key (reply_to_id) references public.messages(id) on delete set null';
  end if;
end $$;

-- ------------------------------------------------------------------
-- 3) INDEX
-- ------------------------------------------------------------------
create index if not exists messages_reply_to_id_idx on public.messages (reply_to_id);

-- ------------------------------------------------------------------
-- 4) RELOAD POSTGREST SCHEMA CACHE (this is usually the real fix)
-- ------------------------------------------------------------------
notify pgrst, 'reload schema';
