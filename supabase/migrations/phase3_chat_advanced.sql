-- ============================================================
-- PHASE 3 (PART 6) — WhatsApp-style messaging features
-- Run AFTER phase3_chat_schema.sql and phase3_chat_part3.sql.
-- Idempotent — safe to re-run.
-- ============================================================

-- ============================================================
-- 1) NEW MESSAGE COLUMNS
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

create index if not exists messages_reply_to_id_idx on public.messages (reply_to_id);

-- ============================================================
-- 2) KEEP chats.last_message PREVIEW SENSIBLE
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

-- ============================================================
-- 3) TAMPER-GUARD — only the sender may change content/edit/delete
--    for everyone; anyone may only add/remove *themselves* from
--    deleted_for. Runs on UPDATE so RLS alone can't be abused.
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
-- 4) RLS — let participants update read state / their own deleted_for.
--    Content-level changes are guarded by the trigger above.
-- ============================================================
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
