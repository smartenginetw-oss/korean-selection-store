-- Paid orders keep their inventory hold until fulfillment settles it.
-- Checkout reservations start with a short expiry, but the existing checkout
-- cleanup runs before later checkouts and must never release stock belonging to
-- an order that has already been paid.

create or replace function private.extend_paid_inventory_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'paid'
    and (tg_op = 'INSERT' or old.status is distinct from new.status) then
    update public.inventory_reservations
    set expires_at = 'infinity'::timestamptz
    where order_id = new.order_id
      and status = 'active'
      and expires_at <> 'infinity'::timestamptz;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_extend_paid_inventory_reservation on public.payments;
create trigger payments_extend_paid_inventory_reservation
after insert or update of status on public.payments
for each row
execute function private.extend_paid_inventory_reservation();

-- Protect paid reservations that were created before this trigger existed.
update public.inventory_reservations r
set expires_at = 'infinity'::timestamptz
from public.payments p
where p.order_id = r.order_id
  and p.status = 'paid'
  and r.status = 'active'
  and r.expires_at <> 'infinity'::timestamptz;

revoke all on function private.extend_paid_inventory_reservation() from public, anon, authenticated;
grant usage on schema private to service_role;
