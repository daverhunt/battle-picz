create or replace function public.finalize_weekly_tournaments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_week date := private.tournament_week_start();
  battle record;
  participant record;
  player_one uuid;
  player_two uuid;
  player_one_wins integer;
  player_two_wins integer;
  completed_rounds integer;
  match_winner uuid;
  outcome text;
  existing_reward integer;
  coin_bonus integer;
  finalized integer := 0;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  for battle in
    select m.id, m.week_start
    from public.matches m
    join public.match_players caller_membership
      on caller_membership.match_id = m.id and caller_membership.user_id = caller
    where m.week_start < current_week and m.status in ('waiting', 'active')
    order by m.week_start, m.created_at
    for update of m
  loop
    if (
      select count(*) from public.match_players mp
      where mp.match_id = battle.id and mp.accepted_at is not null
    ) < 2 then
      update public.matches set status = 'cancelled', completed_at = now()
      where id = battle.id;
      finalized := finalized + 1;
      continue;
    end if;

    select mp.user_id into player_one from public.match_players mp
    where mp.match_id = battle.id and mp.player_no = 1;
    select mp.user_id into player_two from public.match_players mp
    where mp.match_id = battle.id and mp.player_no = 2;

    select
      count(*) filter (where one_turn.score > two_turn.score),
      count(*) filter (where two_turn.score > one_turn.score),
      count(*)
    into player_one_wins, player_two_wins, completed_rounds
    from public.match_turns one_turn
    join public.match_turns two_turn
      on two_turn.match_id = one_turn.match_id
     and two_turn.round_no = one_turn.round_no
     and two_turn.user_id = player_two
    where one_turn.match_id = battle.id and one_turn.user_id = player_one;

    match_winner := case
      when player_one_wins > player_two_wins then player_one
      when player_two_wins > player_one_wins then player_two
      else null
    end;
    update public.matches
    set status = 'complete',
        completed_at = ((battle.week_start + 7)::timestamp at time zone 'UTC'),
        winner_id = match_winner
    where id = battle.id;

    if completed_rounds > 0 then
      for participant in
        select mp.user_id from public.match_players mp
        where mp.match_id = battle.id and mp.accepted_at is not null
      loop
        outcome := case when match_winner is null then 'draw'
          when participant.user_id = match_winner then 'won' else 'lost' end;

        insert into public.weekly_rewards(user_id, week_start)
        values (participant.user_id, battle.week_start)
        on conflict (user_id, week_start) do nothing;

        select wr.coins into existing_reward
        from public.weekly_rewards wr
        where wr.user_id = participant.user_id and wr.week_start = battle.week_start
        for update;

        coin_bonus := case when existing_reward = 0 then 10 else 0 end
          + case when outcome = 'won' then 5 else 0 end;

        update public.weekly_rewards
        set battles_played = battles_played + 1,
            battles_won = battles_won + case when outcome = 'won' then 1 else 0 end,
            battles_lost = battles_lost + case when outcome = 'lost' then 1 else 0 end,
            battles_drawn = battles_drawn + case when outcome = 'draw' then 1 else 0 end,
            rounds_played = rounds_played + completed_rounds,
            coins = coins + coin_bonus,
            updated_at = now()
        where user_id = participant.user_id and week_start = battle.week_start;

        update public.profiles
        set coins = coins + coin_bonus,
            games_played = games_played + 1,
            games_won = games_won + case when outcome = 'won' then 1 else 0 end
        where id = participant.user_id;
      end loop;
    end if;
    finalized := finalized + 1;
  end loop;
  -- The unique player/week row makes repeat opens and concurrent taps safe.
  insert into public.weekly_rewards(user_id, week_start, coins)
  values (caller, current_week, 10)
  on conflict (user_id, week_start) do nothing;
  if found then
    update public.profiles set coins = coins + 10 where id = caller;
  end if;
  return finalized;
end;
$$;
-- Repair the missed week for players with recorded evidence of a visit.
with visitors as (
  select created_by as id from public.matches where week_start = date '2026-10-26'
  union select user_id from public.match_turns
    where completed_at >= timestamptz '2026-10-26 00:00 UTC' and completed_at < timestamptz '2026-11-02 00:00 UTC'
  union select id from auth.users
    where last_sign_in_at >= timestamptz '2026-10-26 00:00 UTC' and last_sign_in_at < timestamptz '2026-11-02 00:00 UTC'
), credited as (
  insert into public.weekly_rewards(user_id, week_start, coins)
  select p.id, date '2026-10-26', 10 from visitors join public.profiles p using (id)
  on conflict (user_id, week_start) do nothing returning user_id
)
update public.profiles p set coins = p.coins + 10 from credited where p.id = credited.user_id;
