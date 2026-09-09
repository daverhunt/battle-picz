begin;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Player'
    check (char_length(display_name) between 1 and 24),
  xp bigint not null default 0 check (xp >= 0),
  coins bigint not null default 0 check (coins >= 0),
  skill_rating integer not null default 1000 check (skill_rating between 0 and 5000),
  games_played integer not null default 0 check (games_played >= 0),
  games_won integer not null default 0 check (games_won between 0 and games_played),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  mode text not null check (mode in ('challenge', 'random', 'rematch')),
  status text not null default 'waiting'
    check (status in ('waiting', 'active', 'complete', 'cancelled')),
  invite_code text unique check (invite_code is null or invite_code ~ '^[A-Z0-9]{6}$'),
  seed uuid not null default gen_random_uuid(),
  game_config jsonb not null default '{}'::jsonb,
  created_by uuid not null references public.profiles(id) on delete restrict,
  invited_user_id uuid references public.profiles(id) on delete set null,
  rematch_of uuid references public.matches(id) on delete set null,
  winner_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  expires_at timestamptz,
  check (invited_user_id is null or invited_user_id <> created_by)
);

create table public.match_players (
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  player_no smallint not null check (player_no in (1, 2)),
  joined_at timestamptz not null default now(),
  accepted_at timestamptz,
  total_score integer not null default 0 check (total_score >= 0),
  primary key (match_id, user_id),
  unique (match_id, player_no)
);

create table public.match_turns (
  id bigint generated always as identity primary key,
  match_id uuid not null references public.matches(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  round_no smallint not null check (round_no between 1 and 99),
  score integer not null check (score between 0 and 1000000),
  answers jsonb not null default '[]'::jsonb,
  ghost_timeline jsonb not null default '[]'::jsonb,
  is_final boolean not null default false,
  completed_at timestamptz not null default now(),
  unique (match_id, user_id, round_no),
  foreign key (match_id, user_id)
    references public.match_players(match_id, user_id) on delete cascade,
  check (jsonb_typeof(answers) = 'array'),
  check (jsonb_typeof(ghost_timeline) = 'array')
);

create table public.matchmaking_queue (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  skill_rating integer not null check (skill_rating between 0 and 5000),
  joined_at timestamptz not null default now()
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  push_token text not null,
  updated_at timestamptz not null default now(),
  unique (platform, push_token)
);

create index matches_invited_user_idx on public.matches(invited_user_id, status);
create index matches_created_at_idx on public.matches(created_at desc);
create index match_players_user_idx on public.match_players(user_id, match_id);
create index match_turns_match_round_idx on public.match_turns(match_id, round_no);
create index matchmaking_rating_joined_idx
  on public.matchmaking_queue(skill_rating, joined_at);
create index devices_user_idx on public.devices(user_id);

create or replace function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
before update on public.profiles
for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    left(coalesce(nullif(new.raw_user_meta_data ->> 'display_name', ''), 'Player'), 24)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function private.handle_new_user();

create or replace function private.is_match_participant(p_match_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.match_players mp
    where mp.match_id = p_match_id
      and mp.user_id = auth.uid()
  );
$$;

create or replace function private.new_invite_code()
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text := '';
begin
  for i in 1..6 loop
    result := result || substr(alphabet, 1 + floor(random() * length(alphabet))::integer, 1);
  end loop;
  return result;
end;
$$;

create or replace function public.create_challenge(
  p_game_config jsonb default '{}'::jsonb,
  p_invited_user_id uuid default null
)
returns table(match_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  created_match uuid;
  code text;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;
  if p_invited_user_id = caller then
    raise exception 'You cannot challenge yourself';
  end if;

  insert into public.profiles(id) values (caller) on conflict (id) do nothing;

  loop
    code := private.new_invite_code();
    begin
      insert into public.matches (
        mode, status, invite_code, game_config, created_by,
        invited_user_id, expires_at
      ) values (
        case when p_invited_user_id is null then 'challenge' else 'rematch' end,
        'waiting', code, coalesce(p_game_config, '{}'::jsonb), caller,
        p_invited_user_id, now() + interval '7 days'
      ) returning id into created_match;
      exit;
    exception when unique_violation then
      -- Extremely unlikely; generate another human-friendly code.
    end;
  end loop;

  insert into public.match_players(match_id, user_id, player_no, accepted_at)
  values (created_match, caller, 1, now());

  if p_invited_user_id is not null then
    insert into public.match_players(match_id, user_id, player_no)
    values (created_match, p_invited_user_id, 2);
  end if;

  return query select created_match, code;
end;
$$;

create or replace function public.join_challenge(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  target public.matches%rowtype;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles(id) values (caller) on conflict (id) do nothing;

  select * into target
  from public.matches
  where invite_code = upper(trim(p_invite_code))
  for update;

  if target.id is null or target.status <> 'waiting'
     or target.expires_at <= now() then
    raise exception 'Challenge is unavailable or expired';
  end if;
  if target.created_by = caller then
    raise exception 'You cannot join your own challenge';
  end if;
  if target.invited_user_id is not null and target.invited_user_id <> caller then
    raise exception 'This challenge belongs to another player';
  end if;

  insert into public.match_players(match_id, user_id, player_no, accepted_at)
  values (target.id, caller, 2, now())
  on conflict (match_id, user_id)
  do update set accepted_at = now();

  update public.matches
  set status = 'active', started_at = coalesce(started_at, now())
  where id = target.id;

  return target.id;
end;
$$;

create or replace function public.create_rematch(p_match_id uuid)
returns table(match_id uuid, invite_code text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  opponent uuid;
  config jsonb;
  created_match uuid;
  code text;
begin
  if caller is null or not private.is_match_participant(p_match_id) then
    raise exception 'Match not found';
  end if;

  select mp.user_id into opponent
  from public.match_players mp
  where mp.match_id = p_match_id and mp.user_id <> caller
  limit 1;

  if opponent is null then
    raise exception 'This match has no opponent';
  end if;

  select m.game_config into config from public.matches m where m.id = p_match_id;

  select c.match_id, c.invite_code
  into created_match, code
  from public.create_challenge(config, opponent) c;

  update public.matches
  set rematch_of = p_match_id
  where id = created_match;

  return query select created_match, code;
end;
$$;

create or replace function public.accept_match(p_match_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
begin
  update public.match_players mp
  set accepted_at = now()
  where mp.match_id = p_match_id and mp.user_id = caller and mp.accepted_at is null;

  if not found then
    raise exception 'Match invitation not found';
  end if;

  update public.matches m
  set status = 'active', started_at = coalesce(m.started_at, now())
  where m.id = p_match_id
    and m.status = 'waiting'
    and not exists (
      select 1 from public.match_players mp
      where mp.match_id = p_match_id and mp.accepted_at is null
    );

  return p_match_id;
end;
$$;

create or replace function public.find_random_match()
returns table(match_id uuid, match_status text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  caller_rating integer;
  opponent uuid;
  created_match uuid;
begin
  if caller is null then
    raise exception 'Authentication required';
  end if;

  insert into public.profiles(id) values (caller) on conflict (id) do nothing;
  select p.skill_rating into caller_rating from public.profiles p where p.id = caller;

  delete from public.matchmaking_queue where joined_at < now() - interval '10 minutes';

  select q.user_id into opponent
  from public.matchmaking_queue q
  where q.user_id <> caller
    and abs(q.skill_rating - caller_rating) <= least(
      500,
      100 + floor(extract(epoch from (now() - q.joined_at)) / 15)::integer * 50
    )
  order by abs(q.skill_rating - caller_rating), q.joined_at
  for update skip locked
  limit 1;

  if opponent is null then
    insert into public.matchmaking_queue(user_id, skill_rating, joined_at)
    values (caller, caller_rating, now())
    on conflict (user_id) do update
      set skill_rating = excluded.skill_rating,
          joined_at = excluded.joined_at;
    return query select null::uuid, 'waiting'::text;
    return;
  end if;

  delete from public.matchmaking_queue where user_id in (caller, opponent);
  insert into public.matches(mode, status, created_by, started_at)
  values ('random', 'active', caller, now())
  returning id into created_match;

  insert into public.match_players(match_id, user_id, player_no, accepted_at)
  values
    (created_match, opponent, 1, now()),
    (created_match, caller, 2, now());

  return query select created_match, 'active'::text;
end;
$$;

create or replace function public.leave_matchmaking()
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.matchmaking_queue where user_id = auth.uid();
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
begin
  if caller is null or not private.is_match_participant(p_match_id) then
    raise exception 'Match not found';
  end if;
  if p_round_no not between 1 and 99 or p_score not between 0 and 1000000 then
    raise exception 'Invalid turn values';
  end if;
  if jsonb_typeof(p_answers) <> 'array' or jsonb_typeof(p_ghost_timeline) <> 'array' then
    raise exception 'Turn details must be arrays';
  end if;

  insert into public.match_turns(
    match_id, user_id, round_no, score, answers, ghost_timeline, is_final
  ) values (
    p_match_id, caller, p_round_no, p_score, p_answers, p_ghost_timeline, p_is_final
  )
  on conflict (match_id, user_id, round_no) do update
  set score = excluded.score,
      answers = excluded.answers,
      ghost_timeline = excluded.ghost_timeline,
      is_final = excluded.is_final,
      completed_at = now();

  update public.match_players
  set total_score = (
    select coalesce(sum(t.score), 0)::integer
    from public.match_turns t
    where t.match_id = p_match_id and t.user_id = caller
  )
  where match_id = p_match_id and user_id = caller;

  if p_is_final and (
    select count(distinct t.user_id)
    from public.match_turns t
    where t.match_id = p_match_id and t.is_final
  ) = 2 then
    update public.matches m
    set status = 'complete',
        completed_at = now(),
        winner_id = (
          select mp.user_id
          from public.match_players mp
          where mp.match_id = p_match_id
          order by mp.total_score desc, mp.player_no
          limit 1
        )
    where m.id = p_match_id;
  end if;
end;
$$;

alter table public.profiles enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.match_turns enable row level security;
alter table public.matchmaking_queue enable row level security;
alter table public.devices enable row level security;

revoke all on all tables in schema public from anon, authenticated;
grant select on public.profiles to authenticated;
grant update(display_name) on public.profiles to authenticated;
grant select on public.matches, public.match_players, public.match_turns to authenticated;
grant select on public.matchmaking_queue to authenticated;
grant select, insert, update, delete on public.devices to authenticated;

create policy profiles_read_authenticated on public.profiles
for select to authenticated using (true);
create policy profiles_update_self on public.profiles
for update to authenticated using (id = auth.uid()) with check (id = auth.uid());

create policy matches_read_participants on public.matches
for select to authenticated
using (
  private.is_match_participant(id)
  or created_by = auth.uid()
  or invited_user_id = auth.uid()
);

create policy match_players_read_match on public.match_players
for select to authenticated using (private.is_match_participant(match_id));

create policy turns_read_match on public.match_turns
for select to authenticated using (private.is_match_participant(match_id));

create policy queue_read_self on public.matchmaking_queue
for select to authenticated using (user_id = auth.uid());

create policy devices_read_self on public.devices
for select to authenticated using (user_id = auth.uid());
create policy devices_insert_self on public.devices
for insert to authenticated with check (user_id = auth.uid());
create policy devices_update_self on public.devices
for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy devices_delete_self on public.devices
for delete to authenticated using (user_id = auth.uid());

revoke all on function public.create_challenge(jsonb, uuid) from public, anon;
revoke all on function public.join_challenge(text) from public, anon;
revoke all on function public.create_rematch(uuid) from public, anon;
revoke all on function public.accept_match(uuid) from public, anon;
revoke all on function public.find_random_match() from public, anon;
revoke all on function public.leave_matchmaking() from public, anon;
revoke all on function public.submit_turn(uuid, smallint, integer, jsonb, jsonb, boolean) from public, anon;

grant execute on function public.create_challenge(jsonb, uuid) to authenticated;
grant execute on function public.join_challenge(text) to authenticated;
grant execute on function public.create_rematch(uuid) to authenticated;
grant execute on function public.accept_match(uuid) to authenticated;
grant execute on function public.find_random_match() to authenticated;
grant execute on function public.leave_matchmaking() to authenticated;
grant execute on function public.submit_turn(uuid, smallint, integer, jsonb, jsonb, boolean) to authenticated;

revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.handle_new_user() from public, anon, authenticated;
revoke all on function private.is_match_participant(uuid) from public, anon, authenticated;
revoke all on function private.new_invite_code() from public, anon, authenticated;

commit;
