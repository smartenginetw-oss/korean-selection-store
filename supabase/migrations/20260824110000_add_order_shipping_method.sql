-- Persist the delivery method selected at checkout.
-- V1 only exposes home_delivery; future methods can extend this constraint
-- together with the checkout validator and carrier/fee rules.
alter table public.orders
  add column if not exists shipping_method text not null default 'home_delivery';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'orders_shipping_method_check'
      and conrelid = 'public.orders'::regclass
  ) then
    alter table public.orders
      add constraint orders_shipping_method_check
      check (shipping_method = 'home_delivery');
  end if;
end;
$$;
