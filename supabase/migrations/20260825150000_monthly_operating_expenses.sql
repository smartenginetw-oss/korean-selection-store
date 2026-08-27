-- Owner/staff-managed monthly operating expenses for the income statement.
-- Values are whole TWD amounts for the selected calendar month.

create table if not exists public.operating_expenses (
  id uuid primary key default gen_random_uuid(),
  period_month date not null,
  rent_cost integer not null default 0,
  shipping_cost integer not null default 0,
  advertising_cost integer not null default 0,
  packaging_cost integer not null default 0,
  other_cost integer not null default 0,
  notes text not null default '',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint operating_expenses_month_start check (period_month = date_trunc('month', period_month)::date),
  constraint operating_expenses_nonnegative check (
    rent_cost >= 0
    and shipping_cost >= 0
    and advertising_cost >= 0
    and packaging_cost >= 0
    and other_cost >= 0
  ),
  constraint operating_expenses_period_unique unique (period_month)
);

create index if not exists operating_expenses_period_idx on public.operating_expenses(period_month);
alter table public.operating_expenses enable row level security;

create or replace function private.can_manage_operating_expenses()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'staff')
  );
$$;

drop policy if exists operating_expenses_report_select on public.operating_expenses;
drop policy if exists operating_expenses_manage on public.operating_expenses;
create policy operating_expenses_report_select on public.operating_expenses
  for select to authenticated using (private.can_view_reports());
create policy operating_expenses_manage on public.operating_expenses
  for all to authenticated using (private.can_manage_operating_expenses()) with check (private.can_manage_operating_expenses());

create or replace function private.upsert_admin_operating_expense(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_period_month date := nullif(trim(p_payload->>'periodMonth'), '')::date;
  v_rent_cost integer := coalesce(nullif(trim(p_payload->>'rentCost'), '')::integer, 0);
  v_shipping_cost integer := coalesce(nullif(trim(p_payload->>'shippingCost'), '')::integer, 0);
  v_advertising_cost integer := coalesce(nullif(trim(p_payload->>'advertisingCost'), '')::integer, 0);
  v_packaging_cost integer := coalesce(nullif(trim(p_payload->>'packagingCost'), '')::integer, 0);
  v_other_cost integer := coalesce(nullif(trim(p_payload->>'otherCost'), '')::integer, 0);
  v_notes text := left(trim(coalesce(p_payload->>'notes', '')), 500);
  v_id uuid;
begin
  if not coalesce(private.can_manage_operating_expenses(), false) then
    raise exception using errcode = '42501', message = 'Owner or operations staff role is required';
  end if;
  if v_period_month is null or v_period_month <> date_trunc('month', v_period_month)::date then
    raise exception using errcode = '22023', message = 'A calendar month is required';
  end if;
  if v_rent_cost < 0 or v_shipping_cost < 0 or v_advertising_cost < 0 or v_packaging_cost < 0 or v_other_cost < 0 then
    raise exception using errcode = '22023', message = 'Operating costs cannot be negative';
  end if;

  insert into public.operating_expenses (
    period_month, rent_cost, shipping_cost, advertising_cost, packaging_cost, other_cost, notes, created_by
  ) values (
    v_period_month, v_rent_cost, v_shipping_cost, v_advertising_cost, v_packaging_cost, v_other_cost, v_notes, auth.uid()
  )
  on conflict (period_month) do update set
    rent_cost = excluded.rent_cost,
    shipping_cost = excluded.shipping_cost,
    advertising_cost = excluded.advertising_cost,
    packaging_cost = excluded.packaging_cost,
    other_cost = excluded.other_cost,
    notes = excluded.notes,
    updated_at = now()
  returning id into v_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, resource_type, resource_id, changed_fields
  ) values (
    auth.uid(),
    'operating_expense.upsert',
    'operating_expense',
    v_id,
    array['period_month', 'rent_cost', 'shipping_cost', 'advertising_cost', 'packaging_cost', 'other_cost', 'notes']::text[]
  );

  return jsonb_build_object('id', v_id, 'periodMonth', v_period_month);
end;
$$;

create or replace function public.upsert_admin_operating_expense(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.upsert_admin_operating_expense(p_payload);
$$;

revoke all on function private.can_manage_operating_expenses() from public, anon, authenticated;
grant execute on function private.can_manage_operating_expenses() to authenticated;
revoke all on function private.upsert_admin_operating_expense(jsonb) from public, anon, authenticated;
revoke all on function public.upsert_admin_operating_expense(jsonb) from public, anon, authenticated;
grant execute on function public.upsert_admin_operating_expense(jsonb) to authenticated;
