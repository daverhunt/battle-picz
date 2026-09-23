begin;

alter table public.profiles
  add column if not exists power_bomb integer not null default 2 check (power_bomb >= 0),
  add column if not exists power_remove integer not null default 10 check (power_remove >= 0),
  add column if not exists power_reveal integer not null default 5 check (power_reveal >= 0);

create or replace function public.consume_power_up(p_power_up text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  inventory jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if p_power_up not in ('bomb', 'remove', 'reveal') then
    raise exception 'Unknown power-up';
  end if;

  update public.profiles
  set power_bomb = power_bomb - case when p_power_up = 'bomb' then 1 else 0 end,
      power_remove = power_remove - case when p_power_up = 'remove' then 1 else 0 end,
      power_reveal = power_reveal - case when p_power_up = 'reveal' then 1 else 0 end
  where id = caller
    and case p_power_up
      when 'bomb' then power_bomb
      when 'remove' then power_remove
      when 'reveal' then power_reveal
    end > 0
  returning jsonb_build_object(
    'bomb', power_bomb,
    'remove', power_remove,
    'reveal', power_reveal
  ) into inventory;

  if inventory is null then
    raise exception 'No % power-ups remaining', p_power_up;
  end if;
  return inventory;
end;
$$;

revoke all on function public.consume_power_up(text) from public, anon;
grant execute on function public.consume_power_up(text) to authenticated;

create or replace function public.reset_my_game_data()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  deleted_matches integer := 0;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  delete from public.matchmaking_queue where user_id = caller;
  delete from public.weekly_rewards where user_id = caller;

  delete from public.matches m
  where exists (
    select 1 from public.match_players mp
    where mp.match_id = m.id and mp.user_id = caller
  );
  get diagnostics deleted_matches = row_count;

  update public.profiles
  set xp = 0,
      coins = 0,
      skill_rating = 1000,
      games_played = 0,
      games_won = 0,
      power_bomb = 2,
      power_remove = 10,
      power_reveal = 5
  where id = caller;

  return jsonb_build_object('matches_deleted', deleted_matches);
end;
$$;

revoke all on function public.reset_my_game_data() from public, anon;
grant execute on function public.reset_my_game_data() to authenticated;

commit;
