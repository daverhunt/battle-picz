-- Transaction-only fixtures: no users, coins, games, or notifications survive.
begin;
do $$
declare
 a uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); m uuid; m2 uuid; code text;
 config jsonb; again jsonb; second jsonb; expected text[]; ids text[]; bad boolean:=false;
begin
 insert into auth.users(id,raw_user_meta_data) values(a,'{}'),(b,'{}');
 perform set_config('request.jwt.claim.sub',a::text,true);
 select match_id,invite_code into m,code from public.create_challenge('{}',null);
 begin perform public.set_round_config(m,1,'SPORT','easy'); exception when raise_exception then bad:=sqlerrm='Unlock this category before choosing it'; end;
 if not bad then raise exception 'Locked category was selectable'; end if;
 bad:=false;
 begin perform public.purchase_category('SPORT'); exception when raise_exception then bad:=sqlerrm='Not enough coins'; end;
 if not bad then raise exception 'Purchase without funds succeeded'; end if;
 update public.profiles set coins=40 where id=a;
 perform public.purchase_category('SPORT');perform public.purchase_category('SPORT');
 if (select coins from public.profiles where id=a)<>25 then raise exception 'Incorrect/double charge'; end if;
 config:=public.set_round_config(m,1,'SPORT','easy');
 again:=public.set_round_config(m,1,'FOOD','hard');
 if config<>again or jsonb_array_length(config->'questions')<>3 then raise exception 'Deal not stable'; end if;
 select array_agg(q->>'id') into ids from jsonb_array_elements(config->'questions') q;
 select match_id into m2 from public.create_challenge('{}',null);
 second:=public.set_round_config(m2,1,'SPORT','easy');
 if exists(select 1 from jsonb_array_elements(second->'questions') q where q->>'id'=any(ids)) then raise exception 'Repeated while unseen pictures remain'; end if;
 -- Exhaustion chooses least recently used pictures rather than arbitrary repeats.
 insert into public.picture_history(user_id,picture_id,last_used_at,uses)
 select a,id,'2020-01-01'::timestamptz + row_number() over(order by id)*interval '1 day',1
 from public.category_pictures where category_id='SPORT'
 on conflict(user_id,picture_id) do update set last_used_at=excluded.last_used_at;
 select array_agg(picture_id) into expected from (select picture_id from public.picture_history where user_id=a order by last_used_at limit 3) oldest;
 select match_id into m2 from public.create_challenge('{}',null);
 second:=public.set_round_config(m2,1,'SPORT','easy');
 if exists(select 1 from jsonb_array_elements(second->'questions') q where not(q->>'id'=any(expected))) then raise exception 'Did not choose least recently used pictures'; end if;
 if has_table_privilege('authenticated','public.category_unlocks','INSERT') or has_table_privilege('authenticated','public.picture_history','UPDATE') then raise exception 'Client can mutate protected state'; end if;
 if has_function_privilege('anon','public.purchase_category(text)','EXECUTE') then raise exception 'Unsigned callers can purchase'; end if;
 perform public.submit_turn(m,1,100,'[]','[]',false);
 perform set_config('request.jwt.claim.sub',b::text,true);
 perform public.join_challenge(code);
 if (select count(*) from public.picture_history where user_id=b)<>3 then raise exception 'Joining opponent history missing'; end if;
 if exists(select 1 from public.category_unlocks where user_id=b) then raise exception 'Opponent incorrectly charged/unlocked'; end if;
 perform public.submit_turn(m,1,50,'[]','[]',false);
 bad:=false;
 begin perform public.set_round_config(m,2,'SPORT','easy'); exception when raise_exception then bad:=sqlerrm='Unlock this category before choosing it'; end;
 if not bad then raise exception 'Opponent can choose unowned category'; end if;
 perform public.set_round_config(m,2,'ANIMALS','easy');
end; $$;
rollback;
