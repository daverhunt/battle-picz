begin;
create table public.categories (
 id text primary key, name text not null, price integer not null check(price>=0), sort_order integer not null
);
create table public.category_pictures (
 id text primary key, category_id text not null references public.categories(id),
 question jsonb not null, active boolean not null default true
);
create unique index category_picture_answer on public.category_pictures(category_id,(question->>'a'));
create table public.category_unlocks (
 user_id uuid references public.profiles(id) on delete cascade,
 category_id text references public.categories(id), coins_paid integer not null check(coins_paid>=0),
 unlocked_at timestamptz not null default now(), primary key(user_id,category_id)
);
create table public.picture_history (
 user_id uuid references public.profiles(id) on delete cascade,
 picture_id text references public.category_pictures(id), last_used_at timestamptz not null default now(),
 uses integer not null default 1, primary key(user_id,picture_id)
);
alter table public.categories enable row level security;
alter table public.category_pictures enable row level security;
alter table public.category_unlocks enable row level security;
alter table public.picture_history enable row level security;
revoke all on public.categories,public.category_pictures,public.category_unlocks,public.picture_history from public,anon,authenticated;
grant select on public.categories,public.category_pictures,public.category_unlocks,public.picture_history to authenticated;
create policy categories_read on public.categories for select to authenticated using(true);
create policy pictures_read on public.category_pictures for select to authenticated using(true);
create policy unlocks_read_self on public.category_unlocks for select to authenticated using(user_id=(select auth.uid()));
create policy history_read_self on public.picture_history for select to authenticated using(user_id=(select auth.uid()));
insert into public.categories(id,name,price,sort_order) values
('ANIMALS','Animals',0,1),('FOOD','Food & Drink',0,2),('OBJECTS','Everyday Objects',0,3),('TRANSPORT','Transport',0,4),
('SPORT','Sport',20,5),('LANDMARKS','Famous Landmarks',30,6),('MUSIC','Musical Instruments',20,7),('PLANTS','Plants & Flowers',20,8),
('TOOLS','Tools & DIY',20,9),('JOBS','Jobs & Professions',25,10),('SPACE','Space',30,11),('CLOTHING','Clothing & Accessories',20,12);

create function public.list_categories() returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null then raise exception 'Authentication required'; end if;
 select jsonb_build_object('coins',p.coins,'categories',(
 select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'price',case when c.price>0 and not exists(select 1 from public.category_unlocks where user_id=caller) then 15 else c.price end,
 'owned',c.price=0 or exists(select 1 from public.category_unlocks u where u.user_id=caller and u.category_id=c.id),
 'pictureCount',(select count(*) from public.category_pictures q where q.category_id=c.id and q.active)) order by c.sort_order)
 from public.categories c)) into result from public.profiles p where p.id=caller;
 return result;
end; $$;
create function public.purchase_category(p_category text) returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); balance bigint; cost integer; category text:=upper(p_category);
begin
 if caller is null then raise exception 'Authentication required'; end if;
 select coins into balance from public.profiles where id=caller for update;
 select price into cost from public.categories where id=category;
 if cost is null then raise exception 'Unknown category'; end if;
 if cost=0 or exists(select 1 from public.category_unlocks where user_id=caller and category_id=category) then
   return jsonb_build_object('coins',balance,'alreadyOwned',true);
 end if;
 if (select count(*) from public.category_pictures where category_id=category and active)<3 then raise exception 'This category is not ready yet'; end if;
 if not exists(select 1 from public.category_unlocks where user_id=caller) then cost:=15; end if;
 if balance<cost then raise exception 'Not enough coins'; end if;
 update public.profiles set coins=coins-cost where id=caller;
 insert into public.category_unlocks(user_id,category_id,coins_paid) values(caller,category,cost);
 return jsonb_build_object('coins',balance-cost,'coinsPaid',cost,'alreadyOwned',false);
end; $$;
revoke all on function public.list_categories(),public.purchase_category(text) from public,anon;
grant execute on function public.list_categories(),public.purchase_category(text) to authenticated;

create or replace function public.set_round_config(
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
  selected_questions jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  if p_round_no is null or p_round_no < 1 then raise exception 'Invalid round number'; end if;
  if p_category is null or not exists(select 1 from public.categories where id=upper(p_category)) then
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

  -- Serialize selection across battles involving these players, in stable order.
  perform p.id from public.profiles p join public.match_players mp on mp.user_id=p.id
  where mp.match_id=p_match_id order by p.id for update of p;
  if exists(select 1 from public.categories where id=upper(p_category) and price>0)
     and not exists(select 1 from public.category_unlocks where user_id=caller and category_id=upper(p_category)) then
    raise exception 'Unlock this category before choosing it';
  end if;
  select jsonb_agg(chosen.question || jsonb_build_object('id',chosen.id) order by chosen.last_used nulls first,chosen.shuffle)
  into selected_questions from (
    select q.id,q.question,max(h.last_used_at) as last_used,random() as shuffle
    from public.category_pictures q
    left join public.picture_history h on h.picture_id=q.id and h.user_id in (
      select user_id from public.match_players where match_id=p_match_id)
    where q.category_id=upper(p_category) and q.active
    group by q.id order by max(h.last_used_at) nulls first,shuffle limit 3
  ) chosen;
  if coalesce(jsonb_array_length(selected_questions),0)<>3 then raise exception 'This category needs more pictures'; end if;
  -- Reserve this deal for both players so another concurrent battle avoids it too.
  insert into public.picture_history(user_id,picture_id,last_used_at,uses)
  select mp.user_id,q->>'id',clock_timestamp(),1 from public.match_players mp,
    jsonb_array_elements(selected_questions) q where mp.match_id=p_match_id
  on conflict(user_id,picture_id) do update set last_used_at=excluded.last_used_at,uses=picture_history.uses+1;
  round_config := jsonb_build_object(
    'category',upper(p_category),'difficulty',lower(p_difficulty),'questions',selected_questions
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
-- A link challenge can be dealt before the second player joins. Record that deal on acceptance.
create function private.record_joined_pictures() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if new.player_no<>2 or new.accepted_at is null then return new; end if;
 if tg_op='UPDATE' and old.accepted_at is not null then return new; end if;
 insert into public.picture_history(user_id,picture_id,last_used_at,uses)
 select new.user_id,q->>'id',clock_timestamp(),1 from public.matches m,
 jsonb_each(coalesce(m.game_config->'rounds','{}'::jsonb)) r,
 jsonb_array_elements(coalesce(r.value->'questions','[]'::jsonb)) q
 where m.id=new.match_id and exists(select 1 from public.category_pictures p where p.id=q->>'id')
 on conflict(user_id,picture_id) do update set last_used_at=excluded.last_used_at,uses=picture_history.uses+1;
 return new;
end; $$;
revoke all on function private.record_joined_pictures() from public,anon,authenticated;
create trigger record_joined_pictures after insert or update of accepted_at on public.match_players
for each row execute function private.record_joined_pictures();
commit;
