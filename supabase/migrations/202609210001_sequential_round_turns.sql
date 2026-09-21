begin;

create or replace function public.submit_turn(
  p_match_id uuid,
  p_round_no integer,
  p_score integer,
  p_answers jsonb,
  p_ghost_timeline jsonb,
  p_is_final boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_player_no smallint;
  expected_player_no smallint;
  match_status text;
  match_week date;
  match_config jsonb;
  player_one uuid;
  player_two uuid;
  player_one_score integer;
  player_two_score integer;
begin
  if caller is null or not private.is_match_participant(p_match_id) then
    raise exception 'Match not found';
  end if;
  if p_round_no is null or p_score is null
     or p_round_no < 1 or p_score not between 0 and 1000000 then
    raise exception 'Invalid turn values';
  end if;
  if p_answers is null or p_ghost_timeline is null
     or jsonb_typeof(p_answers) <> 'array' or jsonb_typeof(p_ghost_timeline) <> 'array' then
    raise exception 'Turn details must be arrays';
  end if;

  select mp.player_no into caller_player_no
  from public.match_players mp
  where mp.match_id = p_match_id and mp.user_id = caller;

  select m.status, m.week_start, m.game_config
  into match_status, match_week, match_config
  from public.matches m where m.id = p_match_id for update;

  if match_week <> private.tournament_week_start() then
    raise exception 'This weekly tournament has ended';
  end if;
  if match_status is distinct from 'active'
     and not (match_status = 'waiting' and p_round_no = 1 and caller_player_no = 1) then
    raise exception 'This match is not ready to play';
  end if;
  if match_config #> array['rounds', p_round_no::text] is null then
    raise exception 'Choose the round category and difficulty first';
  end if;
  if p_round_no > 1 and (
    select count(distinct t.user_id)
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no - 1
  ) <> 2 then
    raise exception 'Complete the previous round first';
  end if;
  if exists (
    select 1 from public.match_turns t
    where t.match_id = p_match_id and t.user_id = caller and t.round_no = p_round_no
  ) then
    raise exception 'This round has already been submitted';
  end if;

  expected_player_no := case when p_round_no % 2 = 1 then 1 else 2 end;
  if caller_player_no <> expected_player_no and not exists (
    select 1
    from public.match_turns t
    join public.match_players starter
      on starter.match_id = t.match_id and starter.user_id = t.user_id
    where t.match_id = p_match_id
      and t.round_no = p_round_no
      and starter.player_no = expected_player_no
  ) then
    raise exception 'Wait for the round starter to finish first';
  end if;

  insert into public.match_turns(
    match_id, user_id, round_no, score, answers, ghost_timeline, is_final
  ) values (
    p_match_id, caller, p_round_no, p_score, p_answers, p_ghost_timeline, false
  );

  update public.match_players
  set total_score = (
    select coalesce(sum(t.score), 0)::integer
    from public.match_turns t
    where t.match_id = p_match_id and t.user_id = caller
  )
  where match_id = p_match_id and user_id = caller;

  if (
    select count(distinct t.user_id)
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no
  ) = 2 then
    select mp.user_id into player_one
    from public.match_players mp
    where mp.match_id = p_match_id and mp.player_no = 1;
    select mp.user_id into player_two
    from public.match_players mp
    where mp.match_id = p_match_id and mp.player_no = 2;
    select t.score into player_one_score
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no and t.user_id = player_one;
    select t.score into player_two_score
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no and t.user_id = player_two;

    with awarded as (
      insert into public.match_round_rewards(match_id, round_no, user_id, result, coins)
      values
        (p_match_id, p_round_no, player_one,
          case when player_one_score = player_two_score then 'draw'
               when player_one_score > player_two_score then 'won' else 'lost' end,
          case when player_one_score = player_two_score then 2
               when player_one_score > player_two_score then 3 else 1 end),
        (p_match_id, p_round_no, player_two,
          case when player_one_score = player_two_score then 'draw'
               when player_two_score > player_one_score then 'won' else 'lost' end,
          case when player_one_score = player_two_score then 2
               when player_two_score > player_one_score then 3 else 1 end)
      on conflict (match_id, round_no, user_id) do nothing
      returning user_id, coins
    )
    update public.profiles p
    set coins = p.coins + awarded.coins
    from awarded
    where p.id = awarded.user_id;
  end if;
end;
$$;

revoke all on function public.submit_turn(uuid, integer, integer, jsonb, jsonb, boolean)
  from public, anon;
grant execute on function public.submit_turn(uuid, integer, integer, jsonb, jsonb, boolean)
  to authenticated;

commit;
