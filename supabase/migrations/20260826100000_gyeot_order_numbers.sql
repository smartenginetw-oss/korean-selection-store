-- Customer-facing order numbers use the GYEOT prefix from this migration
-- onward. Existing MR-prefixed numbers remain immutable for payment and audit
-- history.

create table if not exists private.order_number_counters (
  order_date date primary key,
  last_value integer not null check (last_value > 0 and last_value <= 9999),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function private.next_gyeot_order_number(p_at timestamptz default now())
returns text
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_order_date date := (coalesce(p_at, now()) at time zone 'Asia/Taipei')::date;
  v_next integer;
begin
  insert into private.order_number_counters (order_date, last_value)
  values (v_order_date, 1)
  on conflict (order_date) do update
    set last_value = private.order_number_counters.last_value + 1,
        updated_at = now()
  returning last_value into v_next;

  if v_next > 9999 then
    raise exception using
      errcode = '22003',
      message = 'Daily GYEOT order number limit reached';
  end if;

  return 'GY' || to_char(v_order_date, 'YYMMDD') || '-' || lpad(v_next::text, 4, '0');
end;
$$;

create or replace function private.assign_gyeot_order_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Checkout RPCs historically generate MR + YYYYMMDD + UUID. Convert only
  -- that generated shape; explicit legacy/imported numbers stay untouched.
  if new.order_number ~ '^MR[0-9]{8}-[0-9A-Fa-f]{8}$' then
    new.order_number := private.next_gyeot_order_number(coalesce(new.created_at, now()));
  end if;
  return new;
end;
$$;

drop trigger if exists orders_assign_gyeot_order_number on public.orders;
create trigger orders_assign_gyeot_order_number
before insert on public.orders
for each row execute function private.assign_gyeot_order_number();

revoke all on table private.order_number_counters from public, anon, authenticated;
revoke all on function private.next_gyeot_order_number(timestamptz) from public, anon, authenticated;
revoke all on function private.assign_gyeot_order_number() from public, anon, authenticated;
