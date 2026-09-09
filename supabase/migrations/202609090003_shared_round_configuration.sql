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
  current_config jsonb;
  round_path text[] := array['rounds', p_round_no::text];
  round_config jsonb;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if p_round_no not between 1 and 99 then
    raise exception 'Invalid round number';
  end if;
  if upper(p_category) not in ('ANIMALS', 'FOOD', 'SPORT') then
    raise exception 'Invalid category';
  end if;
  if lower(p_difficulty) not in ('easy', 'medium', 'hard') then
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

  select coalesce(m.game_config, '{}'::jsonb) into current_config
  from public.matches m
  where m.id = p_match_id and m.status in ('waiting', 'active')
  for update;

  if current_config is null then
    raise exception 'Match is unavailable';
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

revoke all on function public.set_round_config(uuid, smallint, text, text) from public, anon;
grant execute on function public.set_round_config(uuid, smallint, text, text) to authenticated;

commit;
