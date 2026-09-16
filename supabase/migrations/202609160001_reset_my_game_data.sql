begin;

create function public.reset_my_game_data()
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
      games_won = 0
  where id = caller;

  return jsonb_build_object('matches_deleted', deleted_matches);
end;
$$;

revoke all on function public.reset_my_game_data() from public, anon;
grant execute on function public.reset_my_game_data() to authenticated;

commit;
