-- Store per-unit operating cost allocations used by the owner pricing calculator.
-- These are not customer-facing prices; they are internal estimates for rent,
-- shipping, advertising, packaging, and other operating expenses.

alter table public.products
  add column if not exists allocated_rent_cost integer not null default 0,
  add column if not exists allocated_shipping_cost integer not null default 0,
  add column if not exists allocated_ad_cost integer not null default 0,
  add column if not exists allocated_packaging_cost integer not null default 0,
  add column if not exists allocated_other_cost integer not null default 0;

alter table public.products
  drop constraint if exists products_operating_costs_nonnegative;

alter table public.products
  add constraint products_operating_costs_nonnegative check (
    allocated_rent_cost >= 0
    and allocated_shipping_cost >= 0
    and allocated_ad_cost >= 0
    and allocated_packaging_cost >= 0
    and allocated_other_cost >= 0
  );

create or replace function private.update_admin_product_financials(p_product_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rent_cost integer := coalesce(nullif(trim(p_payload->>'rentCost'), '')::integer, 0);
  v_shipping_cost integer := coalesce(nullif(trim(p_payload->>'shippingCost'), '')::integer, 0);
  v_ad_cost integer := coalesce(nullif(trim(p_payload->>'advertisingCost'), '')::integer, 0);
  v_packaging_cost integer := coalesce(nullif(trim(p_payload->>'packagingCost'), '')::integer, 0);
  v_other_cost integer := coalesce(nullif(trim(p_payload->>'otherOperatingCost'), '')::integer, 0);
begin
  if not coalesce(private.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Admin role is required';
  end if;
  if p_product_id is null or not exists (select 1 from public.products where id = p_product_id) then
    raise exception using errcode = 'P0002', message = 'Product was not found';
  end if;
  if v_rent_cost < 0 or v_shipping_cost < 0 or v_ad_cost < 0 or v_packaging_cost < 0 or v_other_cost < 0 then
    raise exception using errcode = '22023', message = 'Operating costs cannot be negative';
  end if;

  update public.products
  set allocated_rent_cost = v_rent_cost,
      allocated_shipping_cost = v_shipping_cost,
      allocated_ad_cost = v_ad_cost,
      allocated_packaging_cost = v_packaging_cost,
      allocated_other_cost = v_other_cost,
      updated_at = now()
  where id = p_product_id;

  insert into public.admin_audit_logs (
    admin_user_id, action, resource_type, resource_id, changed_fields
  ) values (
    auth.uid(),
    'product.financials.update',
    'product',
    p_product_id,
    array['allocated_rent_cost', 'allocated_shipping_cost', 'allocated_ad_cost', 'allocated_packaging_cost', 'allocated_other_cost']::text[]
  );

  return jsonb_build_object('id', p_product_id);
end;
$$;

create or replace function public.update_admin_product_financials(p_product_id uuid, p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_admin_product_financials(p_product_id, p_payload);
$$;

revoke all on function private.update_admin_product_financials(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_admin_product_financials(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_admin_product_financials(uuid, jsonb) to authenticated;
