-- Prevent 1:1 chats where both participants are the same user.
alter table public.chats
  drop constraint if exists chats_participants_distinct;

alter table public.chats
  add constraint chats_participants_distinct check (participant_1 <> participant_2);
