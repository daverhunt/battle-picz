create schema if not exists private;
create table private.match_archive(match_id uuid primary key, completed_at timestamptz not null, archived_at timestamptz not null default now(), participant_ids uuid[] not null, snapshot jsonb not null);
revoke all on private.match_archive from public,anon,authenticated;
create index on private.match_archive using gin(participant_ids);
create index matches_archive_cutoff on public.matches(completed_at,id) where status='complete';
create function private.archive_completed_matches() returns integer language plpgsql set search_path='' set timezone='UTC' as $$
declare m public.matches; moved integer:=0;
begin
 for m in select * from public.matches where status='complete' and completed_at + interval '1 month' <= now() order by completed_at,id limit 100 for update skip locked loop
 insert into private.match_archive(match_id,completed_at,participant_ids,snapshot)
 select m.id,m.completed_at,array(select user_id from public.match_players where match_id=m.id),jsonb_build_object('match',to_jsonb(m),'match_players',(select coalesce(jsonb_agg(t),'[]') from public.match_players t where t.match_id=m.id),'match_turns',(select coalesce(jsonb_agg(t),'[]') from public.match_turns t where t.match_id=m.id),'match_round_rewards',(select coalesce(jsonb_agg(t),'[]') from public.match_round_rewards t where t.match_id=m.id),'match_nudges',(select coalesce(jsonb_agg(t),'[]') from public.match_nudges t where t.match_id=m.id),'notification_outbox',(select coalesce(jsonb_agg(t),'[]') from public.notification_outbox t where t.match_id=m.id),'push_receipts',(select coalesce(jsonb_agg(r),'[]') from public.web_push_receipts r join public.notification_outbox n on n.id=r.event_id where n.match_id=m.id),'rematches',array(select id from public.matches where rematch_of=m.id));
 delete from public.matches where id=m.id;
 moved:=moved+1;
 end loop;
 return moved;
end $$;
revoke all on function private.archive_completed_matches() from public,anon,authenticated;
do $$ declare src text:=pg_get_functiondef('public.reset_my_game_data()'::regprocedure); begin
if strpos(src,'get diagnostics deleted_matches = row_count;')=0 then raise exception 'Unexpected reset function'; end if;
execute replace(src,'get diagnostics deleted_matches = row_count;', 'get diagnostics deleted_matches = row_count;
with removed as (delete from private.match_archive where participant_ids @> array[caller] returning 1)
select deleted_matches + count(*) into deleted_matches from removed;');
end $$;
select cron.schedule('pic-rivals-archive-completed','17 * * * *','select private.archive_completed_matches()');