-- Trial unit prices. Debit and inventory credit happen atomically.
create or replace function public.purchase_power_up(p_power_up text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  caller uuid := auth.uid();
  price integer;
  inventory jsonb;
begin
  if caller is null then raise exception 'Authentication required'; end if;
  price := case p_power_up when 'bomb' then 9 when 'remove' then 3 when 'reveal' then 6 end;
  if price is null then raise exception 'Unknown power-up'; end if;
  update public.profiles
  set coins = coins - price,
      power_bomb = power_bomb + case when p_power_up = 'bomb' then 1 else 0 end,
      power_remove = power_remove + case when p_power_up = 'remove' then 1 else 0 end,
      power_reveal = power_reveal + case when p_power_up = 'reveal' then 1 else 0 end
  where id = caller and coins >= price
  returning jsonb_build_object('coins', coins, 'bomb', power_bomb, 'remove', power_remove, 'reveal', power_reveal) into inventory;
  if inventory is null then raise exception 'Not enough coins'; end if;
  return inventory;
end;
$$;
revoke all on function public.purchase_power_up(text) from public, anon;
grant execute on function public.purchase_power_up(text) to authenticated;
