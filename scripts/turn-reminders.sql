create or replace view private.pending_turn_reminders as
select m.id as match_id, p.user_id, r.round_no,
 greatest(m.created_at, m.started_at, p.accepted_at,
   (select max(t.completed_at) from public.match_turns t where t.match_id=m.id and t.round_no<=r.round_no)) as waiting_since
from public.matches m
cross join lateral (
 select n as round_no from generate_series(1,coalesce((select max(round_no) from public.match_turns where match_id=m.id),0)+1) n
 where (select count(distinct user_id) from public.match_turns where match_id=m.id and round_no=n)<2
 order by n limit 1
) r
join public.match_players p on p.match_id=m.id and p.accepted_at is not null
where m.week_start=private.tournament_week_start()
 and m.status in ('active','waiting')
 and not exists(select 1 from public.match_turns t where t.match_id=m.id and t.round_no=r.round_no and t.user_id=p.user_id)
 and ((m.status='waiting' and p.player_no=1 and r.round_no=1)
   or (m.status='active' and (p.player_no=case when r.round_no%2=1 then 1 else 2 end
     or exists(select 1 from public.match_turns t where t.match_id=m.id and t.round_no=r.round_no and t.user_id<>p.user_id))));
revoke all on private.pending_turn_reminders from public,anon,authenticated;

create or replace function private.queue_turn_reminders()
returns void language plpgsql security definer set search_path='' as $$
begin
 insert into public.notification_outbox(recipient_user_id,event_type,match_id,round_no,payload,dedupe_key)
 select user_id,'turn_ready',match_id,round_no,
 jsonb_build_object('reminder',true,'screen','match','match_id',match_id,'round_no',round_no),
 'turn-reminder:'||match_id||':'||round_no||':'||user_id
 from private.pending_turn_reminders
 where waiting_since < now()-interval '48 hours'
 on conflict(dedupe_key) do nothing;

 update public.notification_outbox n set status='cancelled',locked_at=null,last_error='Turn no longer waiting'
 where n.status='pending' and n.payload->>'reminder'='true'
 and not exists(select 1 from private.pending_turn_reminders p where p.match_id=n.match_id and p.user_id=n.recipient_user_id and p.round_no=n.round_no);
end;
$$;
revoke all on function private.queue_turn_reminders() from public,anon,authenticated;
select cron.schedule('pic-rivals-48-hour-turn-reminders','*/15 * * * *','select private.queue_turn_reminders()');
create or replace function public.turn_reminder_pending(p_match_id uuid,p_user_id uuid,p_round_no integer)
returns boolean language sql security definer set search_path='' as $$
 select exists(select 1 from private.pending_turn_reminders where match_id=p_match_id and user_id=p_user_id and round_no=p_round_no);
$$;
revoke all on function public.turn_reminder_pending(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.turn_reminder_pending(uuid,uuid,integer) to service_role;
