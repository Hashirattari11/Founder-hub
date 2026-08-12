-- Fix connection requests + message sends rolling back due to profile protection trigger.
-- sync_connections_count updates profiles.connections_count after every connection change,
-- but protect_role_columns blocked that update and aborted the whole transaction.

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

  perform set_config('founderhub.internal_sync', 'connections_count', true);

  update public.profiles p
  set connections_count = (
    select count(*)
    from public.connections c
    where c.status = 'accepted'
      and (c.requester_id = p.id or c.receiver_id = p.id)
  )
  where p.id = any(affected);

  perform set_config('founderhub.internal_sync', '', true);
  return coalesce(new, old);
exception
  when others then
    perform set_config('founderhub.internal_sync', '', true);
    return coalesce(new, old);
end;
$$;

create or replace function public.protect_role_columns()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and coalesce(current_setting('founderhub.internal_sync', true), '') = 'connections_count' then
    return new;
  end if;

  if auth.uid() is not null then
    if tg_op = 'INSERT' then
      if new.is_admin is not false
         or new.is_super_admin is not false
         or new.is_verified is not false
         or new.is_premium is not false
         or new.suspended_at is not null
         or new.suspension_reason is not null
         or new.banned_at is not null
         or new.ban_reason is not null
         or new.connections_count <> 0 then
        raise exception 'Privileged and system fields are admin-managed.';
      end if;
      if new.id is distinct from auth.uid() then
        raise exception 'Profile id must match the authenticated user.';
      end if;
      if new.role in ('administrator', 'admin') then
        raise exception 'Administrator role must be granted by an admin.';
      end if;
    else
      if old.id is distinct from auth.uid() then
        raise exception 'You can only update your own profile.';
      end if;
      if new.is_admin is distinct from old.is_admin
         or new.is_super_admin is distinct from old.is_super_admin then
        raise exception 'Admin flags cannot be changed by users.';
      end if;
      if new.is_verified is distinct from old.is_verified
         or new.is_premium is distinct from old.is_premium
         or new.suspended_at is distinct from old.suspended_at
         or new.suspension_reason is distinct from old.suspension_reason
         or new.banned_at is distinct from old.banned_at
         or new.ban_reason is distinct from old.ban_reason then
        raise exception 'Verification, premium and moderation fields are admin-managed.';
      end if;
      if new.connections_count is distinct from old.connections_count
         or new.id is distinct from old.id
         or new.created_at is distinct from old.created_at then
        raise exception 'System fields cannot be changed by users.';
      end if;
      if new.role is distinct from old.role then
        if old.username is not null then
          raise exception 'Role changes require admin approval. Submit a role change request instead.';
        end if;
        if new.role in ('administrator', 'admin') then
          raise exception 'Administrator role must be granted by an admin.';
        end if;
      end if;
    end if;
  end if;
  return new;
end;
$$;

-- Notification triggers must never roll back the parent insert.
create or replace function public.notify_connection_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'pending' then
    begin
      insert into public.notifications (user_id, type, title, body, data)
      select
        new.receiver_id,
        'connection_request',
        'New connection request',
        coalesce(p.full_name, 'Someone') || ' sent you a connection request',
        jsonb_build_object('requester_id', new.requester_id, 'requester_username', p.username)
      from public.profiles p
      where p.id = new.requester_id;
    exception when others then
      null;
    end;
  end if;
  return new;
end;
$$;

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
    return new;
  end if;

  select full_name into sender_name from public.profiles where id = new.sender_id;

  begin
    insert into public.notifications (user_id, type, title, body, data)
    values (
      other_participant,
      'new_message',
      'New message',
      coalesce(sender_name, 'Someone') || ' sent you a message',
      jsonb_build_object('chat_id', new.chat_id, 'sender_id', new.sender_id)
    );
  exception when others then
    null;
  end;

  return new;
end;
$$;

create or replace function public.touch_chat_last_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  begin
    update public.chats
    set
      last_message_at = coalesce(new.created_at, now()),
      last_message = left(coalesce(new.content, ''), 500)
    where id = new.chat_id;
  exception when others then
    null;
  end;
  return new;
end;
$$;
