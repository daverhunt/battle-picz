-- Keep lobby payloads bounded and omit answer pictures and ghost timelines.
create or replace function public.lobby_page(p_after uuid default null, p_week date default null)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  caller uuid := auth.uid();
  items jsonb;
  profile jsonb;
  coins bigint;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if p_after is null and p_week is not null then
    perform public.finalize_weekly_tournaments();
    select to_jsonb(p) into profile from public.profiles p where id = caller;
    select w.coins into coins from public.weekly_rewards w
      where w.user_id = caller and w.week_start = p_week;
  end if;
  with page as materialized (
    select m.* from public.match_players mine join public.matches m on m.id = mine.match_id
    where mine.user_id = caller and (p_after is null or m.id > p_after)
      and (m.status <> 'cancelled' or (m.week_start = p_week and m.created_by = caller))
    order by m.id limit 51
  ), visible as (select * from page order by id limit 50)
  select jsonb_build_object(
    'next', case when (select count(*) from page) > 50 then
      (select id from visible order by id desc limit 1) end,
    'items', coalesce((select jsonb_agg(
      case when m.status = 'cancelled' then jsonb_build_object('expired',true,'match',jsonb_build_object('id',m.id))
      else jsonb_build_object(
        'match', (to_jsonb(m)-'game_config') || jsonb_build_object('game_config',jsonb_build_object('rounds',
          (select jsonb_object_agg(key,jsonb_build_object('category',value->'category','difficulty',value->'difficulty'))
           from jsonb_each(m.game_config->'rounds')))),
        'players', (select jsonb_agg(to_jsonb(mp) || jsonb_build_object('profiles',jsonb_build_object('display_name',p.display_name)) order by mp.player_no)
           from public.match_players mp join public.profiles p on p.id=mp.user_id where mp.match_id=m.id),
        'turns', coalesce((select jsonb_agg(jsonb_build_object('user_id',t.user_id,'round_no',t.round_no,'score',t.score,'completed_at',t.completed_at) order by t.round_no)
           from public.match_turns t where t.match_id=m.id),'[]'),
        'nudges', coalesce((select jsonb_agg(to_jsonb(n) order by n.created_at desc) from
           (select distinct on (from_user_id) from_user_id,to_user_id,created_at,match_id from public.match_nudges
            where match_id=m.id order by from_user_id,created_at desc) n),'[]')
      ) end order by m.id) from visible m),'[]'),
    'profile',profile,'coins',coalesce(coins,0)
  ) into items;
  return items;
end;
$$;
revoke all on function public.lobby_page(uuid,date) from public,anon;
grant execute on function public.lobby_page(uuid,date) to authenticated;
