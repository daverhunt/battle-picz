begin;

alter table public.devices
  add column if not exists provider text not null default 'fcm',
  add column if not exists device_id text,
  add column if not exists enabled boolean not null default true,
  add column if not exists last_seen_at timestamptz not null default now(),
  add column if not exists disabled_at timestamptz,
  add column if not exists failure_count integer not null default 0;

alter table public.devices
  drop constraint if exists devices_provider_check,
  add constraint devices_provider_check check (provider in ('fcm')),
  drop constraint if exists devices_failure_count_check,
  add constraint devices_failure_count_check check (failure_count >= 0);

create index if not exists devices_enabled_user_idx
  on public.devices(user_id)
  where enabled;

create table public.notification_outbox (
  id bigint generated always as identity primary key,
  recipient_user_id uuid not null references public.profiles(id) on delete cascade,
  actor_user_id uuid references public.profiles(id) on delete set null,
  event_type text not null check (
    event_type in (
      'challenge_received',
      'challenge_accepted',
      'match_found',
      'turn_ready',
      'results_ready',
      'nudge',
      'weekly_summary'
    )
  ),
  match_id uuid references public.matches(id) on delete cascade,
  round_no integer check (round_no is null or round_no >= 1),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object'),
  dedupe_key text not null unique,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'sent', 'failed', 'cancelled')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  delivered_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index notification_outbox_pending_idx
  on public.notification_outbox(available_at, id)
  where status = 'pending';
create index notification_outbox_recipient_idx
  on public.notification_outbox(recipient_user_id, created_at desc);

alter table public.notification_outbox enable row level security;
revoke all on public.notification_outbox from public, anon, authenticated;

create trigger notification_outbox_touch_updated_at
before update on public.notification_outbox
for each row execute function private.touch_updated_at();

create or replace function public.register_push_device(
  p_platform text,
  p_push_token text,
  p_device_id text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  registered_id uuid;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if p_platform not in ('ios', 'android', 'web') then
    raise exception 'Unsupported push platform';
  end if;
  if p_push_token is null or char_length(trim(p_push_token)) < 16 then
    raise exception 'Invalid push token';
  end if;

  insert into public.devices(
    user_id, platform, provider, push_token, device_id, enabled,
    last_seen_at, disabled_at, failure_count, updated_at
  ) values (
    caller, p_platform, 'fcm', trim(p_push_token), nullif(trim(p_device_id), ''),
    true, now(), null, 0, now()
  )
  on conflict (platform, push_token) do update
  set user_id = caller,
      provider = 'fcm',
      device_id = excluded.device_id,
      enabled = true,
      last_seen_at = now(),
      disabled_at = null,
      failure_count = 0,
      updated_at = now()
  returning id into registered_id;

  return registered_id;
end;
$$;

create or replace function public.unregister_push_device(p_push_token text)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.devices
  set enabled = false,
      disabled_at = now(),
      updated_at = now()
  where user_id = auth.uid()
    and push_token = trim(p_push_token);
$$;

create or replace function private.enqueue_notification(
  p_recipient_user_id uuid,
  p_event_type text,
  p_dedupe_key text,
  p_match_id uuid default null,
  p_round_no integer default null,
  p_actor_user_id uuid default null,
  p_payload jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_recipient_user_id is null then return; end if;

  insert into public.notification_outbox(
    recipient_user_id, actor_user_id, event_type, match_id, round_no,
    payload, dedupe_key
  ) values (
    p_recipient_user_id, p_actor_user_id, p_event_type, p_match_id, p_round_no,
    coalesce(p_payload, '{}'::jsonb), p_dedupe_key
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

create or replace function private.notification_match_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invited_user_id is not null then
    perform private.enqueue_notification(
      new.invited_user_id,
      'challenge_received',
      'match:' || new.id || ':challenge_received:' || new.invited_user_id,
      new.id,
      1,
      new.created_by,
      jsonb_build_object(
        'screen', 'match',
        'match_id', new.id,
        'round_no', 1,
        'kind', new.mode
      )
    );
  end if;
  return new;
end;
$$;

create or replace function private.notification_match_player_accepted()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  match_mode text;
  notification_type text;
begin
  if new.player_no <> 2 or new.accepted_at is null then return new; end if;
  if tg_op = 'UPDATE' then
    if old.accepted_at is not null then return new; end if;
  end if;

  select mp.user_id into recipient
  from public.match_players mp
  where mp.match_id = new.match_id and mp.player_no = 1;

  select m.mode into match_mode
  from public.matches m
  where m.id = new.match_id;

  notification_type := case when match_mode = 'random'
    then 'match_found' else 'challenge_accepted' end;

  perform private.enqueue_notification(
    recipient,
    notification_type,
    'match:' || new.match_id || ':' || notification_type || ':' || recipient,
    new.match_id,
    1,
    new.user_id,
    jsonb_build_object(
      'screen', 'match',
      'match_id', new.match_id,
      'round_no', 1
    )
  );
  return new;
end;
$$;

create or replace function private.notification_turn_completed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recipient uuid;
  completed_turns integer;
  notification_type text;
begin
  select mp.user_id into recipient
  from public.match_players mp
  where mp.match_id = new.match_id
    and mp.user_id <> new.user_id
    and mp.accepted_at is not null
  limit 1;

  if recipient is null then return new; end if;

  select count(distinct t.user_id)::integer into completed_turns
  from public.match_turns t
  where t.match_id = new.match_id and t.round_no = new.round_no;

  notification_type := case when completed_turns >= 2
    then 'results_ready' else 'turn_ready' end;

  perform private.enqueue_notification(
    recipient,
    notification_type,
    'match:' || new.match_id || ':round:' || new.round_no || ':'
      || notification_type || ':' || recipient,
    new.match_id,
    new.round_no,
    new.user_id,
    jsonb_build_object(
      'screen', 'match',
      'match_id', new.match_id,
      'round_no', new.round_no
    )
  );
  return new;
end;
$$;

create or replace function private.notification_nudge_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_notification(
    new.to_user_id,
    'nudge',
    'nudge:' || new.id || ':' || new.to_user_id,
    new.match_id,
    null,
    new.from_user_id,
    jsonb_build_object('screen', 'match', 'match_id', new.match_id)
  );
  return new;
end;
$$;

create or replace function private.notification_weekly_reward_updated()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enqueue_notification(
    new.user_id,
    'weekly_summary',
    'week:' || new.week_start || ':weekly_summary:' || new.user_id,
    null,
    null,
    null,
    jsonb_build_object(
      'screen', 'weekly_summary',
      'week_start', new.week_start
    )
  );
  return new;
end;
$$;

create trigger notification_match_created
after insert on public.matches
for each row execute function private.notification_match_created();

create trigger notification_match_player_accepted
after insert or update of accepted_at on public.match_players
for each row execute function private.notification_match_player_accepted();

create trigger notification_turn_completed
after insert on public.match_turns
for each row execute function private.notification_turn_completed();

create trigger notification_nudge_created
after insert on public.match_nudges
for each row execute function private.notification_nudge_created();

create trigger notification_weekly_reward_updated
after update on public.weekly_rewards
for each row execute function private.notification_weekly_reward_updated();

create or replace function public.claim_notification_outbox(p_limit integer default 50)
returns table(
  event_id bigint,
  recipient_user_id uuid,
  actor_user_id uuid,
  event_type text,
  match_id uuid,
  round_no integer,
  payload jsonb,
  attempts integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
  with picked as (
    select n.id
    from public.notification_outbox n
    where n.status = 'pending'
      and n.available_at <= now()
    order by n.available_at, n.id
    for update skip locked
    limit greatest(1, least(coalesce(p_limit, 50), 100))
  )
  update public.notification_outbox n
  set status = 'processing',
      locked_at = now(),
      attempts = n.attempts + 1
  from picked
  where n.id = picked.id
  returning
    n.id, n.recipient_user_id, n.actor_user_id, n.event_type,
    n.match_id, n.round_no, n.payload, n.attempts;
end;
$$;

create or replace function public.complete_notification_delivery(
  p_event_id bigint,
  p_success boolean,
  p_error text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.notification_outbox n
  set status = case
        when p_success then 'sent'
        when n.attempts >= 8 then 'failed'
        else 'pending'
      end,
      delivered_at = case when p_success then now() else null end,
      available_at = case when p_success or n.attempts >= 8 then n.available_at
        else now() + make_interval(
          secs => least(3600, (15 * power(2, least(n.attempts, 8)))::integer)
        )
      end,
      locked_at = null,
      last_error = case when p_success then null else left(coalesce(p_error, 'Delivery failed'), 1000) end
  where n.id = p_event_id and n.status = 'processing';
end;
$$;

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
  delete from public.notification_outbox
  where recipient_user_id = caller or actor_user_id = caller;
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

revoke all on function public.register_push_device(text, text, text)
  from public, anon;
revoke all on function public.unregister_push_device(text)
  from public, anon;
revoke all on function public.claim_notification_outbox(integer)
  from public, anon, authenticated;
revoke all on function public.complete_notification_delivery(bigint, boolean, text)
  from public, anon, authenticated;

grant execute on function public.register_push_device(text, text, text)
  to authenticated;
grant execute on function public.unregister_push_device(text)
  to authenticated;
grant execute on function public.claim_notification_outbox(integer)
  to service_role;
grant execute on function public.complete_notification_delivery(bigint, boolean, text)
  to service_role;
revoke all on function public.reset_my_game_data()
  from public, anon;
grant execute on function public.reset_my_game_data()
  to authenticated;

revoke all on function private.enqueue_notification(uuid, text, text, uuid, integer, uuid, jsonb)
  from public, anon, authenticated;
revoke all on function private.notification_match_created()
  from public, anon, authenticated;
revoke all on function private.notification_match_player_accepted()
  from public, anon, authenticated;
revoke all on function private.notification_turn_completed()
  from public, anon, authenticated;
revoke all on function private.notification_nudge_created()
  from public, anon, authenticated;
revoke all on function private.notification_weekly_reward_updated()
  from public, anon, authenticated;

commit;
