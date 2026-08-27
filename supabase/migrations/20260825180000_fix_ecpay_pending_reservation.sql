-- ECPay checkout internally starts with the test adapter so the existing
-- atomic checkout validation can be reused. That temporary paid state can
-- trigger the paid-reservation protection before the payment is changed back
-- to pending. Pending ECPay orders must keep the normal short hold instead.

create or replace function private.reset_ecpay_pending_inventory_reservation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_reservation_minutes integer := 15;
begin
  if new.provider = 'ecpay'
     and new.status = 'pending'
     and old.status = 'paid' then
    select coalesce(s.reservation_minutes, 15)
    into v_reservation_minutes
    from public.store_settings s
    where s.id = true;

    update public.inventory_reservations
    set expires_at = now() + make_interval(mins => v_reservation_minutes)
    where order_id = new.order_id
      and status = 'active'
      and expires_at = 'infinity'::timestamptz;
  end if;

  return new;
end;
$$;

drop trigger if exists payments_reset_ecpay_pending_inventory_reservation on public.payments;
create trigger payments_reset_ecpay_pending_inventory_reservation
after update of status on public.payments
for each row
execute function private.reset_ecpay_pending_inventory_reservation();

-- Repair pending ECPay holds created before this guard existed.
update public.inventory_reservations r
set expires_at = now() + make_interval(mins => coalesce(s.reservation_minutes, 15))
from public.payments p
join public.store_settings s on s.id = true
where p.order_id = r.order_id
  and p.provider = 'ecpay'
  and p.status = 'pending'
  and r.status = 'active'
  and r.expires_at = 'infinity'::timestamptz;

revoke all on function private.reset_ecpay_pending_inventory_reservation() from public, anon, authenticated;
grant usage on schema private to service_role;
