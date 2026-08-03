-- ============================================================
-- phase3_messages_fk_force.sql
-- FORCE-create messages.reply_to_id -> messages.id
--  1) drop any existing self-FK on reply_to_id
--  2) add the constraint with the exact name the app expects
--  3) reload PostgREST schema cache
-- ============================================================

do $$
declare r record;
begin
  for r in
    select c.conname
    from pg_constraint c
    join pg_attribute a on a.attrelid = c.conrelid and a.attnum = any(c.conkey)
    where c.conrelid = 'public.messages'::regclass
      and c.contype = 'f'
      and c.confrelid = 'public.messages'::regclass
      and a.attname = 'reply_to_id'
  loop
    execute 'alter table public.messages drop constraint ' || quote_ident(r.conname);
  end loop;
end $$;

alter table public.messages
  add constraint messages_reply_to_id_fkey
  foreign key (reply_to_id) references public.messages(id) on delete set null;

create index if not exists messages_reply_to_id_idx on public.messages (reply_to_id);

notify pgrst, 'reload schema';

-- Verification (paste output back)
select conname, pg_get_constraintdef(oid) as def
from pg_constraint
where conrelid = 'public.messages'::regclass
  and contype = 'f'
order by conname;
