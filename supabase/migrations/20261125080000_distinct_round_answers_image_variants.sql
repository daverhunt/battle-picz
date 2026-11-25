-- Allow multiple distinct pictures to share an answer within a category.
-- Each picture still has a unique ID, and published image paths are unique.
drop index if exists public.category_picture_answer;
create unique index if not exists category_picture_image_path
  on public.category_pictures (category_id, (question->>'image'));

-- Require three unique answers for a selectable category, not merely three images.
CREATE OR REPLACE FUNCTION public.list_categories()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=auth.uid(); result jsonb;
begin
 if caller is null then raise exception 'Authentication required'; end if;
 select jsonb_build_object('coins',p.coins,'categories',(
 select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'price',case when c.price>0 and not exists(select 1 from public.category_unlocks where user_id=caller) then 15 else c.price end,
 'owned',c.price=0 or exists(select 1 from public.category_unlocks u where u.user_id=caller and u.category_id=c.id),
 'pictureCount',(select count(distinct regexp_replace(upper(trim(coalesce(q.question->>'a',''))),'[^A-Z0-9]','','g')) from public.category_pictures q where q.category_id=c.id and q.active)) order by c.sort_order)
 from public.categories c)) into result from public.profiles p where p.id=caller;
 return result;
end; $function$
;
CREATE OR REPLACE FUNCTION public.purchase_category(p_category text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare caller uuid:=auth.uid(); balance bigint; cost integer; category text:=upper(p_category);
begin
 if caller is null then raise exception 'Authentication required'; end if;
 select coins into balance from public.profiles where id=caller for update;
 select price into cost from public.categories where id=category;
 if cost is null then raise exception 'Unknown category'; end if;
 if cost=0 or exists(select 1 from public.category_unlocks where user_id=caller and category_id=category) then
   return jsonb_build_object('coins',balance,'alreadyOwned',true);
 end if;
 if (select count(distinct regexp_replace(upper(trim(coalesce(question->>'a',''))),'[^A-Z0-9]','','g')) from public.category_pictures where category_id=category and active)<3 then raise exception 'This category is not ready yet'; end if;
 if not exists(select 1 from public.category_unlocks where user_id=caller) then cost:=15; end if;
 if balance<cost then raise exception 'Not enough coins'; end if;
 update public.profiles set coins=coins-cost where id=caller;
 insert into public.category_unlocks(user_id,category_id,coins_paid) values(caller,category,cost);
 return jsonb_build_object('coins',balance-cost,'coinsPaid',cost,'alreadyOwned',false);
end; $function$
;

-- Immutable server-side three-question deals, answer-first and freshness-aware.
CREATE OR REPLACE FUNCTION public.set_round_config(p_match_id uuid, p_round_no integer, p_category text, p_difficulty text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- First select three different normalized answers, then select one image
  -- variant of each. An answer with ten variants has the same chance as one
  -- with one variant, and neither player repeats recent answers if avoidable.
  with image_candidates as (
    select q.id, q.question,
      regexp_replace(upper(trim(coalesce(q.question->>'a',''))),'[^A-Z0-9]','','g') as answer_key,
      max(h.last_used_at) as image_last_used,
      coalesce(sum(h.uses),0) as image_uses
    from public.category_pictures q
    left join public.picture_history h on h.picture_id=q.id and h.user_id in (
      select user_id from public.match_players where match_id=p_match_id)
    where q.category_id=upper(p_category) and q.active
    group by q.id
  ),
  answer_candidates as (
    select answer_key, max(image_last_used) as answer_last_used,
      sum(image_uses) as answer_uses
    from image_candidates where answer_key<>''
    group by answer_key
  ),
  chosen_answers as (
    select answer_key, answer_last_used, answer_uses, random() as shuffle
    from answer_candidates
    order by answer_last_used nulls first, answer_uses, shuffle
    limit 3
  ),
  chosen_images as (
    select a.answer_key,a.answer_last_used,a.answer_uses,a.shuffle,
      variant.id,variant.question
    from chosen_answers a
    cross join lateral (
      select i.id,i.question from image_candidates i
      where i.answer_key=a.answer_key
      order by i.image_last_used nulls first,i.image_uses,random()
      limit 1
    ) variant
  )
  select jsonb_agg(chosen.question || jsonb_build_object('id',chosen.id)
    order by chosen.answer_last_used nulls first,chosen.answer_uses,chosen.shuffle)
  into selected_questions from chosen_images chosen;
  if coalesce(jsonb_array_length(selected_questions),0)<>3 then raise exception 'This category needs three different answers'; end if;
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
$function$
;
