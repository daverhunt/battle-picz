begin;
create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;
create table public.web_push_subscriptions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 endpoint text not null unique,
 subscription jsonb not null,
 enabled boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.web_push_subscriptions enable row level security;
revoke all on public.web_push_subscriptions from public, anon, authenticated;
grant all on public.web_push_subscriptions to service_role;
create index web_push_user_idx on public.web_push_subscriptions(user_id) where enabled;
create table public.web_push_receipts (
 event_id bigint references public.notification_outbox(id) on delete cascade,
 subscription_id uuid references public.web_push_subscriptions(id) on delete cascade,
 primary key(event_id, subscription_id)
);
alter table public.web_push_receipts enable row level security;
revoke all on public.web_push_receipts from public, anon, authenticated;
grant all on public.web_push_receipts to service_role;

create function public.register_web_push(p_subscription jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare caller uuid := auth.uid(); ep text := p_subscription->>'endpoint';
begin
 if caller is null then raise exception 'Authentication required'; end if;
 if length(ep) > 4096 or ep is null or ep !~ '^https://([a-zA-Z0-9-]+\.)*push\.apple\.com/|^https://fcm\.googleapis\.com/|^https://updates\.push\.services\.mozilla\.com/' then
   raise exception 'Unsupported push endpoint';
 end if;
 if coalesce(p_subscription->'keys'->>'p256dh','') !~ '^[A-Za-z0-9_-]{87}=?$' or
    coalesce(p_subscription->'keys'->>'auth','') !~ '^[A-Za-z0-9_-]{22}(==)?$' then
   raise exception 'Invalid subscription keys';
 end if;
 if (select count(*) from public.web_push_subscriptions where user_id=caller and enabled and endpoint<>ep) >= 10 then
   raise exception 'Too many registered devices';
 end if;
 insert into public.web_push_subscriptions(user_id,endpoint,subscription)
 values(caller,ep,p_subscription)
 on conflict(endpoint) do update set user_id=caller, subscription=excluded.subscription,enabled=true,updated_at=now(),
 created_at=case when web_push_subscriptions.user_id<>caller or not web_push_subscriptions.enabled then now() else web_push_subscriptions.created_at end;
end; $$;
create function public.unregister_web_push(p_endpoint text) returns void
language sql security definer set search_path = '' as $$
 update public.web_push_subscriptions set enabled=false,updated_at=now() where user_id=auth.uid() and endpoint=p_endpoint;
$$;
create function public.web_push_public_key() returns text
language sql security definer set search_path = '' as $$
 select decrypted_secret from vault.decrypted_secrets where name='battle_picz_vapid_public';
$$;
-- Restricted to service_role: private signing key never goes to the client.
create function public.web_push_sender_config() returns jsonb
language sql security definer set search_path = '' as $$
 select jsonb_build_object(
 'public_key',(select decrypted_secret from vault.decrypted_secrets where name='battle_picz_vapid_public'),
 'private_key',(select decrypted_secret from vault.decrypted_secrets where name='battle_picz_vapid_private'),
 'cron_secret',(select decrypted_secret from vault.decrypted_secrets where name='battle_picz_push_cron'));
$$;
create function public.test_web_push() returns void
language plpgsql security definer set search_path = '' as $$
declare caller uuid:=auth.uid();
begin
 if caller is null then raise exception 'Authentication required'; end if;
 if not exists(select 1 from public.web_push_subscriptions where user_id=caller and enabled) then raise exception 'Enable alerts first'; end if;
 if exists(select 1 from public.notification_outbox where recipient_user_id=caller and payload->>'test'='true' and created_at>now()-interval '1 minute') then
  raise exception 'Please wait a minute before sending another test';
 end if;
 perform private.enqueue_notification(caller,'weekly_summary','push-test:'||gen_random_uuid(),null,null,null,'{"test":true}'::jsonb);
end; $$;
create function public.claim_web_push_events() returns setof public.notification_outbox
language plpgsql security definer set search_path = '' as $$
begin
 update public.notification_outbox set status=case when attempts>=8 then 'failed' else 'pending' end,locked_at=null
 where status='processing' and locked_at<now()-interval '5 minutes';
 -- Old notifications must not be delivered when a player subscribes later.
 update public.notification_outbox set status='cancelled',last_error='Expired before delivery',locked_at=null
 where status='pending' and created_at<now()-interval '24 hours';
 return query
 with picked as (select id from public.notification_outbox where status='pending' and available_at<=now()
 order by available_at,id for update skip locked limit 20)
 update public.notification_outbox n set status='processing',locked_at=now(),attempts=n.attempts+1
 from picked where n.id=picked.id returning n.*;
end; $$;
revoke all on function public.register_web_push(jsonb),public.unregister_web_push(text),public.web_push_public_key(),public.test_web_push() from public,anon;
grant execute on function public.register_web_push(jsonb),public.unregister_web_push(text),public.web_push_public_key(),public.test_web_push() to authenticated;
revoke all on function public.web_push_sender_config(),public.claim_web_push_events() from public,anon,authenticated;
grant execute on function public.web_push_sender_config(),public.claim_web_push_events() to service_role;
-- Cron credential generated within the database; no secret in source control.
select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'battle_picz_push_cron');
select cron.schedule('battle-picz-web-push','* * * * *',$job$
 select net.http_post(
 url:='https://mvatgmgjkbyztdshlwbi.supabase.co/functions/v1/send-web-push',
 headers:=jsonb_build_object('Content-Type','application/json','x-push-secret',(select decrypted_secret from vault.decrypted_secrets where name='battle_picz_push_cron')),
 body:='{}'::jsonb,timeout_milliseconds:=60000
 ) where exists(select 1 from public.notification_outbox where (status='pending' and available_at<=now()) or (status='processing' and locked_at<now()-interval '5 minutes'));
$job$);
commit;
