-- Preserve the product cost used for each order item so reports can calculate
-- merchandise expense without relying on a product's current cost price.
create or replace function private.snapshot_order_item_cost()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.unit_cost is null and new.variant_id is not null then
    select coalesce(v.cost_override, p.cost_price)
      into new.unit_cost
    from public.product_variants v
    join public.products p on p.id = v.product_id
    where v.id = new.variant_id;
  end if;
  return new;
end;
$$;

revoke all on function private.snapshot_order_item_cost() from public, anon, authenticated;

drop trigger if exists order_items_snapshot_cost on public.order_items;
create trigger order_items_snapshot_cost
before insert on public.order_items
for each row execute function private.snapshot_order_item_cost();
