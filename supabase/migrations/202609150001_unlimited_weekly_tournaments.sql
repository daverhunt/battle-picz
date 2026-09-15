begin;

create or replace function private.tournament_week_start(p_at timestamptz default now())
returns date
language sql
stable
set search_path = ''
as $$
  select (p_at at time zone 'UTC')::date
    - (extract(isodow from p_at at time zone 'UTC')::integer - 1);
$$;

alter table public.matches add column if not exists week_start date;

update public.matches
set week_start = private.tournament_week_start(created_at)
where week_start is null;

alter table public.matches
  alter column week_start set default private.tournament_week_start(),
  alter column week_start set not null;

create index if not exists matches_week_status_idx
  on public.matches(week_start, status);

create or replace function private.set_tournament_window()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.week_start := coalesce(new.week_start, private.tournament_week_start());
  new.expires_at := ((new.week_start + 7)::timestamp at time zone 'UTC');
  return new;
end;
$$;

drop trigger if exists matches_set_tournament_window on public.matches;
create trigger matches_set_tournament_window
before insert on public.matches
for each row execute function private.set_tournament_window();

alter table public.match_turns
  drop constraint if exists match_turns_round_no_check;
alter table public.match_turns
  alter column round_no type integer using round_no::integer;
alter table public.match_turns
  add constraint match_turns_round_no_check check (round_no >= 1);

create table public.match_round_rewards (
  match_id uuid not null references public.matches(id) on delete cascade,
  round_no integer not null check (round_no >= 1),
  user_id uuid not null references public.profiles(id) on delete cascade,
  result text not null check (result in ('won', 'draw', 'lost')),
  coins smallint not null check (coins between 0 and 100),
  awarded_at timestamptz not null default now(),
  primary key (match_id, round_no, user_id),
  foreign key (match_id, user_id)
    references public.match_players(match_id, user_id) on delete cascade
);

create table public.weekly_rewards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  week_start date not null,
  battles_played integer not null default 0 check (battles_played >= 0),
  battles_won integer not null default 0 check (battles_won >= 0),
  battles_lost integer not null default 0 check (battles_lost >= 0),
  battles_drawn integer not null default 0 check (battles_drawn >= 0),
  rounds_played integer not null default 0 check (rounds_played >= 0),
  coins integer not null default 0 check (coins >= 0),
  awarded_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, week_start),
  check (battles_won + battles_lost + battles_drawn = battles_played)
);

alter table public.match_round_rewards enable row level security;
alter table public.weekly_rewards enable row level security;

revoke all on public.match_round_rewards, public.weekly_rewards from anon, authenticated;
grant select on public.match_round_rewards, public.weekly_rewards to authenticated;

create policy match_round_rewards_read_self on public.match_round_rewards
for select to authenticated using (user_id = auth.uid());
create policy weekly_rewards_read_self on public.weekly_rewards
for select to authenticated using (user_id = auth.uid());

drop function public.set_round_config(uuid, smallint, text, text);
drop function public.submit_turn(uuid, smallint, integer, jsonb, jsonb, boolean);

create function public.set_round_config(
  p_match_id uuid,
  p_round_no integer,
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
  match_week date;
  current_config jsonb;
  round_path text[] := array['rounds', p_round_no::text];
  round_config jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if p_round_no is null or p_round_no < 1 then raise exception 'Invalid round number'; end if;
  if p_category is null or upper(p_category) not in ('ANIMALS', 'FOOD', 'SPORT') then
    raise exception 'Invalid category';
  end if;
  if p_difficulty is null or lower(p_difficulty) not in ('easy', 'medium', 'hard') then
    raise exception 'Invalid difficulty';
  end if;

  select mp.player_no into caller_player_no
  from public.match_players mp
  where mp.match_id = p_match_id and mp.user_id = caller;
  if caller_player_no is null then raise exception 'Match not found'; end if;

  expected_player_no := case when p_round_no % 2 = 1 then 1 else 2 end;
  if caller_player_no <> expected_player_no then
    raise exception 'The other player chooses this round';
  end if;

  select m.status, m.week_start, coalesce(m.game_config, '{}'::jsonb)
  into match_status, match_week, current_config
  from public.matches m where m.id = p_match_id for update;

  if match_week <> private.tournament_week_start() then
    raise exception 'This weekly tournament has ended';
  end if;
  if match_status is distinct from 'active'
     and not (match_status = 'waiting' and p_round_no = 1 and caller_player_no = 1) then
    raise exception 'This match is not ready to play';
  end if;
  if p_round_no > 1 and (
    select count(distinct t.user_id)
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no - 1
  ) <> 2 then
    raise exception 'Complete the previous round first';
  end if;

  if current_config #> round_path is not null then
    return current_config #> round_path;
  end if;

  round_config := jsonb_build_object(
    'category', upper(p_category), 'difficulty', lower(p_difficulty)
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

create function public.submit_turn(
  p_match_id uuid,
  p_round_no integer,
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
  match_week date;
  match_config jsonb;
  player_one uuid;
  player_two uuid;
  player_one_score integer;
  player_two_score integer;
begin
  if caller is null or not private.is_match_participant(p_match_id) then
    raise exception 'Match not found';
  end if;
  if p_round_no is null or p_score is null
     or p_round_no < 1 or p_score not between 0 and 1000000 then
    raise exception 'Invalid turn values';
  end if;
  if p_answers is null or p_ghost_timeline is null
     or jsonb_typeof(p_answers) <> 'array' or jsonb_typeof(p_ghost_timeline) <> 'array' then
    raise exception 'Turn details must be arrays';
  end if;

  select mp.player_no into caller_player_no
  from public.match_players mp
  where mp.match_id = p_match_id and mp.user_id = caller;

  select m.status, m.week_start, m.game_config
  into match_status, match_week, match_config
  from public.matches m where m.id = p_match_id for update;

  if match_week <> private.tournament_week_start() then
    raise exception 'This weekly tournament has ended';
  end if;
  if match_status is distinct from 'active'
     and not (match_status = 'waiting' and p_round_no = 1 and caller_player_no = 1) then
    raise exception 'This match is not ready to play';
  end if;
  if match_config #> array['rounds', p_round_no::text] is null then
    raise exception 'Choose the round category and difficulty first';
  end if;
  if p_round_no > 1 and (
    select count(distinct t.user_id)
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no - 1
  ) <> 2 then
    raise exception 'Complete the previous round first';
  end if;
  if exists (
    select 1 from public.match_turns t
    where t.match_id = p_match_id and t.user_id = caller and t.round_no = p_round_no
  ) then
    raise exception 'This round has already been submitted';
  end if;

  insert into public.match_turns(
    match_id, user_id, round_no, score, answers, ghost_timeline, is_final
  ) values (
    p_match_id, caller, p_round_no, p_score, p_answers, p_ghost_timeline, false
  );

  update public.match_players
  set total_score = (
    select coalesce(sum(t.score), 0)::integer
    from public.match_turns t
    where t.match_id = p_match_id and t.user_id = caller
  )
  where match_id = p_match_id and user_id = caller;

  if (
    select count(distinct t.user_id)
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no
  ) = 2 then
    select mp.user_id into player_one
    from public.match_players mp
    where mp.match_id = p_match_id and mp.player_no = 1;
    select mp.user_id into player_two
    from public.match_players mp
    where mp.match_id = p_match_id and mp.player_no = 2;
    select t.score into player_one_score
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no and t.user_id = player_one;
    select t.score into player_two_score
    from public.match_turns t
    where t.match_id = p_match_id and t.round_no = p_round_no and t.user_id = player_two;

    with awarded as (
      insert into public.match_round_rewards(match_id, round_no, user_id, result, coins)
      values
        (p_match_id, p_round_no, player_one,
          case when player_one_score = player_two_score then 'draw'
               when player_one_score > player_two_score then 'won' else 'lost' end,
          case when player_one_score = player_two_score then 2
               when player_one_score > player_two_score then 3 else 1 end),
        (p_match_id, p_round_no, player_two,
          case when player_one_score = player_two_score then 'draw'
               when player_two_score > player_one_score then 'won' else 'lost' end,
          case when player_one_score = player_two_score then 2
               when player_two_score > player_one_score then 3 else 1 end)
      on conflict (match_id, round_no, user_id) do nothing
      returning user_id, coins
    )
    update public.profiles p
    set coins = p.coins + awarded.coins
    from awarded
    where p.id = awarded.user_id;
  end if;
end;
$$;

create function public.finalize_weekly_tournaments()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := auth.uid();
  current_week date := private.tournament_week_start();
  battle record;
  participant record;
  player_one uuid;
  player_two uuid;
  player_one_wins integer;
  player_two_wins integer;
  completed_rounds integer;
  match_winner uuid;
  outcome text;
  existing_battles integer;
  coin_bonus integer;
  finalized integer := 0;
begin
  if caller is null then raise exception 'Authentication required'; end if;

  for battle in
    select m.id, m.week_start
    from public.matches m
    join public.match_players caller_membership
      on caller_membership.match_id = m.id and caller_membership.user_id = caller
    where m.week_start < current_week and m.status in ('waiting', 'active')
    order by m.week_start, m.created_at
    for update of m
  loop
    if (
      select count(*) from public.match_players mp
      where mp.match_id = battle.id and mp.accepted_at is not null
    ) < 2 then
      update public.matches set status = 'cancelled', completed_at = now()
      where id = battle.id;
      finalized := finalized + 1;
      continue;
    end if;

    select mp.user_id into player_one from public.match_players mp
    where mp.match_id = battle.id and mp.player_no = 1;
    select mp.user_id into player_two from public.match_players mp
    where mp.match_id = battle.id and mp.player_no = 2;

    select
      count(*) filter (where one_turn.score > two_turn.score),
      count(*) filter (where two_turn.score > one_turn.score),
      count(*)
    into player_one_wins, player_two_wins, completed_rounds
    from public.match_turns one_turn
    join public.match_turns two_turn
      on two_turn.match_id = one_turn.match_id
     and two_turn.round_no = one_turn.round_no
     and two_turn.user_id = player_two
    where one_turn.match_id = battle.id and one_turn.user_id = player_one;

    match_winner := case
      when player_one_wins > player_two_wins then player_one
      when player_two_wins > player_one_wins then player_two
      else null
    end;
    update public.matches
    set status = 'complete',
        completed_at = ((battle.week_start + 7)::timestamp at time zone 'UTC'),
        winner_id = match_winner
    where id = battle.id;

    if completed_rounds > 0 then
      for participant in
        select mp.user_id from public.match_players mp
        where mp.match_id = battle.id and mp.accepted_at is not null
      loop
        outcome := case when match_winner is null then 'draw'
          when participant.user_id = match_winner then 'won' else 'lost' end;

        insert into public.weekly_rewards(user_id, week_start)
        values (participant.user_id, battle.week_start)
        on conflict (user_id, week_start) do nothing;

        select wr.battles_played into existing_battles
        from public.weekly_rewards wr
        where wr.user_id = participant.user_id and wr.week_start = battle.week_start
        for update;

        coin_bonus := case when existing_battles = 0 then 10 else 0 end
          + case when outcome = 'won' then 5 else 0 end;

        update public.weekly_rewards
        set battles_played = battles_played + 1,
            battles_won = battles_won + case when outcome = 'won' then 1 else 0 end,
            battles_lost = battles_lost + case when outcome = 'lost' then 1 else 0 end,
            battles_drawn = battles_drawn + case when outcome = 'draw' then 1 else 0 end,
            rounds_played = rounds_played + completed_rounds,
            coins = coins + coin_bonus,
            updated_at = now()
        where user_id = participant.user_id and week_start = battle.week_start;

        update public.profiles
        set coins = coins + coin_bonus,
            games_played = games_played + 1,
            games_won = games_won + case when outcome = 'won' then 1 else 0 end
        where id = participant.user_id;
      end loop;
    end if;
    finalized := finalized + 1;
  end loop;
  return finalized;
end;
$$;

revoke all on function private.tournament_week_start(timestamptz) from public, anon, authenticated;
revoke all on function private.set_tournament_window() from public, anon, authenticated;
revoke all on function public.set_round_config(uuid, integer, text, text) from public, anon;
revoke all on function public.submit_turn(uuid, integer, integer, jsonb, jsonb, boolean) from public, anon;
revoke all on function public.finalize_weekly_tournaments() from public, anon;

grant execute on function public.set_round_config(uuid, integer, text, text) to authenticated;
grant execute on function public.submit_turn(uuid, integer, integer, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.finalize_weekly_tournaments() to authenticated;

commit;
