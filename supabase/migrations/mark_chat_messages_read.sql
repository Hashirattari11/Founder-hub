-- Mark all incoming messages in a chat as read for the viewer.
-- SECURITY DEFINER so RLS cannot block read-state updates.
create or replace function public.mark_chat_messages_read(
  p_chat_id uuid,
  p_user_id uuid
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_count integer;
begin
  if p_chat_id is null or p_user_id is null then
    return 0;
  end if;

  if not exists (
    select 1
    from public.chats c
    where c.id = p_chat_id
      and (c.participant_1 = p_user_id or c.participant_2 = p_user_id)
  ) then
    return 0;
  end if;

  update public.messages m
  set is_read = true
  where m.chat_id = p_chat_id
    and m.sender_id <> p_user_id
    and coalesce(m.is_read, false) = false;

  get diagnostics updated_count = row_count;
  return updated_count;
end;
$$;

revoke all on function public.mark_chat_messages_read(uuid, uuid) from public;
grant execute on function public.mark_chat_messages_read(uuid, uuid) to authenticated;
grant execute on function public.mark_chat_messages_read(uuid, uuid) to service_role;
