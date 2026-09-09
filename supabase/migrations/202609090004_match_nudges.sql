begin;

create table public.match_nudges (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (from_user_id <> to_user_id)
);

create index match_nudges_recipient_idx
  on public.match_nudges(to_user_id, created_at desc);

alter table public.match_nudges enable row level security;
revoke all on public.match_nudges from anon, authenticated;
grant select on public.match_nudges to authenticated;

create policy match_nudges_read_own on public.match_nudges
for select to authenticated
using (from_user_id = auth.uid() or to_user_id = auth.uid());

create or replace function public.send_match_nudge(p_match_id uuid)
returns timestamptz
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  opponent uuid;
  last_nudge timestamptz;
  sent_at timestamptz := now();
begin
  if caller is null or not private.is_match_participant(p_match_id) then
    raise exception 'Match not found';
  end if;

  if not exists (
    select 1 from public.matches m
    where m.id = p_match_id and m.status in ('waiting', 'active')
  ) then
    raise exception 'This battle is no longer in progress';
  end if;

  select mp.user_id into opponent
  from public.match_players mp
  where mp.match_id = p_match_id
    and mp.user_id <> caller
    and mp.accepted_at is not null
  limit 1;

  if opponent is null then
    raise exception 'There is nobody to nudge yet';
  end if;

  select max(n.created_at) into last_nudge
  from public.match_nudges n
  where n.match_id = p_match_id and n.from_user_id = caller;

  if last_nudge is not null and last_nudge > now() - interval '6 hours' then
    raise exception 'You can nudge this player again in 6 hours';
  end if;

  insert into public.match_nudges(match_id, from_user_id, to_user_id, created_at)
  values (p_match_id, caller, opponent, sent_at);

  return sent_at;
end;
$$;

revoke all on function public.send_match_nudge(uuid) from public, anon;
grant execute on function public.send_match_nudge(uuid) to authenticated;

commit;
