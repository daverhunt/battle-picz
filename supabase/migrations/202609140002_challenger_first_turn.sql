begin;

create or replace function public.set_round_config(
  p_match_id uuid,
  p_round_no smallint,
  p_category text,
  p_difficulty text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_player_no smallint;
  expected_player_no smallint;
  match_status text;
  current_config jsonb;
  round_path text[] := array['rounds', p_round_no::text];
  round_config jsonb;
  prior_round smallint;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if p_round_no is null or p_round_no not between 1 and 3 then
    raise exception 'A match has exactly three rounds';
  end if;
  if p_category is null or upper(p_category) not in ('ANIMALS', 'FOOD', 'SPORT') then
    raise exception 'Invalid category';
  end if;
  if p_difficulty is null or lower(p_difficulty) not in ('easy', 'medium', 'hard') then
    raise exception 'Invalid difficulty';
  end if;

  select mp.player_no into caller_player_no
  from public.match_players mp
  where mp.match_id = p_match_id and mp.user_id = caller;

  if caller_player_no is null then
    raise exception 'Match not found';
  end if;

  expected_player_no := case when p_round_no % 2 = 1 then 1 else 2 end;
  if caller_player_no <> expected_player_no then
    raise exception 'The other player chooses this round';
  end if;

  select m.status, coalesce(m.game_config, '{}'::jsonb)
  into match_status, current_config
  from public.matches m
  where m.id = p_match_id
  for update;

  if match_status is distinct from 'active'
     and not (match_status = 'waiting' and p_round_no = 1 and caller_player_no = 1) then
    raise exception 'This match is not ready to play';
  end if;

  if p_round_no > 1 then
    for prior_round in 1..(p_round_no - 1) loop
      if (
        select count(distinct t.user_id)
        from public.match_turns t
        where t.match_id = p_match_id and t.round_no = prior_round
      ) <> 2 then
        raise exception 'Complete the previous round first';
      end if;
    end loop;
  end if;

  if current_config #> round_path is not null then
    return current_config #> round_path;
  end if;

  round_config := jsonb_build_object(
    'category', upper(p_category),
    'difficulty', lower(p_difficulty)
  );
  current_config := jsonb_set(
    jsonb_set(current_config, '{rounds}', coalesce(current_config -> 'rounds', '{}'::jsonb), true),
    round_path,
    round_config,
    true
  );

  update public.matches set game_config = current_config where id = p_match_id;
  return round_config;
end;
$$;

create or replace function public.submit_turn(
  p_match_id uuid,
  p_round_no smallint,
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
  match_status text;
  match_config jsonb;
  prior_round smallint;
  player_one uuid;
  player_two uuid;
  player_one_wins integer := 0;
  player_two_wins integer := 0;
  match_winner uuid;
begin
  if caller is null or not private.is_match_participant(p_match_id) then
    raise exception 'Match not found';
  end if;
  if p_round_no is null or p_score is null
     or p_round_no not between 1 and 3 or p_score not between 0 and 1000000 then
    raise exception 'Invalid turn values';
  end if;
  if p_answers is null or p_ghost_timeline is null
     or jsonb_typeof(p_answers) <> 'array' or jsonb_typeof(p_ghost_timeline) <> 'array' then
    raise exception 'Turn details must be arrays';
  end if;

  select mp.player_no into caller_player_no
  from public.match_players mp
  where mp.match_id = p_match_id and mp.user_id = caller;

  select m.status, m.game_config
  into match_status, match_config
  from public.matches m
  where m.id = p_match_id
  for update;

  if match_status is distinct from 'active'
     and not (match_status = 'waiting' and p_round_no = 1 and caller_player_no = 1) then
    raise exception 'This match is not ready to play';
  end if;
  if match_config #> array['rounds', p_round_no::text] is null then
    raise exception 'Choose the round category and difficulty first';
  end if;

  if p_round_no > 1 then
    for prior_round in 1..(p_round_no - 1) loop
      if (
        select count(distinct t.user_id)
        from public.match_turns t
        where t.match_id = p_match_id and t.round_no = prior_round
      ) <> 2 then
        raise exception 'Complete the previous round first';
      end if;
    end loop;
  end if;

  if exists (
    select 1 from public.match_turns t
    where t.match_id = p_match_id
      and t.user_id = caller
      and t.round_no = p_round_no
  ) then
    raise exception 'This round has already been submitted';
  end if;

  insert into public.match_turns(
    match_id, user_id, round_no, score, answers, ghost_timeline, is_final
  ) values (
    p_match_id, caller, p_round_no, p_score, p_answers, p_ghost_timeline, p_round_no = 3
  );

  update public.match_players
  set total_score = (
    select coalesce(sum(t.score), 0)::integer
    from public.match_turns t
    where t.match_id = p_match_id and t.user_id = caller
  )
  where match_id = p_match_id and user_id = caller;

  if p_round_no = 3 and (
    select count(distinct t.user_id)
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = 3
  ) = 2 then
    select mp.user_id into player_one
    from public.match_players mp
    where mp.match_id = p_match_id and mp.player_no = 1;

    select mp.user_id into player_two
    from public.match_players mp
    where mp.match_id = p_match_id and mp.player_no = 2;

    select
      count(*) filter (where one_turn.score > two_turn.score),
      count(*) filter (where two_turn.score > one_turn.score)
    into player_one_wins, player_two_wins
    from public.match_turns one_turn
    join public.match_turns two_turn
      on two_turn.match_id = one_turn.match_id
     and two_turn.round_no = one_turn.round_no
     and two_turn.user_id = player_two
    where one_turn.match_id = p_match_id
      and one_turn.user_id = player_one
      and one_turn.round_no between 1 and 3;

    match_winner := case
      when player_one_wins > player_two_wins then player_one
      when player_two_wins > player_one_wins then player_two
      else null
    end;

    update public.matches
    set status = 'complete',
        completed_at = now(),
        winner_id = match_winner
    where id = p_match_id;

    update public.profiles
    set games_played = games_played + 1,
        games_won = games_won + case when id = match_winner then 1 else 0 end
    where id in (player_one, player_two);
  end if;
end;
$$;

revoke all on function public.set_round_config(uuid, smallint, text, text) from public, anon;
revoke all on function public.submit_turn(uuid, smallint, integer, jsonb, jsonb, boolean) from public, anon;

grant execute on function public.set_round_config(uuid, smallint, text, text) to authenticated;
grant execute on function public.submit_turn(uuid, smallint, integer, jsonb, jsonb, boolean) to authenticated;

commit;
