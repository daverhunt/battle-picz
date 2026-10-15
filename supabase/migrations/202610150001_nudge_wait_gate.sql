begin;

-- Gate the existing RPC's insert, preserving its notification trigger and grants.
create or replace function private.check_nudge_wait()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  battle public.matches%rowtype;
  round_no_now integer := 1;
  starter uuid;
  expected_user uuid;
  waiting_since timestamptz;
  last_nudge timestamptz;
begin
  select * into battle from public.matches where id = new.match_id for update;
  if battle.status <> 'active' or battle.week_start <> private.tournament_week_start() then
    raise exception 'This battle is not active';
  end if;
  while (select count(distinct t.user_id) from public.match_turns t
         where t.match_id = new.match_id and t.round_no = round_no_now) = 2 loop
    round_no_now := round_no_now + 1;
  end loop;
  select mp.user_id into starter from public.match_players mp
    where mp.match_id = new.match_id and mp.player_no = case when round_no_now % 2 = 1 then 1 else 2 end;
  expected_user := starter;
  if exists (select 1 from public.match_turns t where t.match_id = new.match_id
             and t.round_no = round_no_now and t.user_id = starter) then
    select mp.user_id into expected_user from public.match_players mp
      where mp.match_id = new.match_id and mp.user_id <> starter;
  end if;
  if new.to_user_id is distinct from expected_user or new.from_user_id = expected_user then
    raise exception 'Wait until it is your opponent''s turn';
  end if;
  select greatest(coalesce(battle.started_at, battle.created_at), max(t.completed_at))
    into waiting_since from public.match_turns t where t.match_id = new.match_id;
  if waiting_since > now() - interval '6 hours' then
    raise exception 'Nudges become available after your opponent has waited six hours';
  end if;
  select max(n.created_at) into last_nudge from public.match_nudges n
    where n.match_id = new.match_id and n.from_user_id = new.from_user_id;
  if last_nudge > now() - interval '6 hours' then
    raise exception 'You can nudge this player again in six hours';
  end if;
  return new;
end;
$$;
revoke all on function private.check_nudge_wait() from public, anon, authenticated;
create trigger match_nudges_wait_gate before insert on public.match_nudges
for each row execute function private.check_nudge_wait();
commit;
