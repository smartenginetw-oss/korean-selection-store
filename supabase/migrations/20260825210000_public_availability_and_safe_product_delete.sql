-- Public catalog availability is intentionally reduced to a boolean.  Raw
-- inventory quantities remain admin-only so customers cannot enumerate stock.
create or replace function public.get_public_variant_availability(p_variant_ids uuid[])
returns table(variant_id uuid, is_available boolean)
language sql
security definer
set search_path = ''
as $$
  select
    pv.id as variant_id,
    case
      when pv.fulfillment_mode = 'preorder' then true
      when pv.fulfillment_mode <> 'in_stock' then false
      else coalesce(il.on_hand - il.reserved > 0, false)
    end as is_available
  from public.product_variants pv
  join public.products p on p.id = pv.product_id and p.status = 'active'
  left join public.inventory_levels il on il.variant_id = pv.id
  where pv.id = any(coalesce(p_variant_ids, '{}'::uuid[]))
    and pv.status = 'active';
$$;

revoke all on function public.get_public_variant_availability(uuid[]) from public;
grant execute on function public.get_public_variant_availability(uuid[]) to anon, authenticated;

-- Only aggregate product ids and quantities are exposed for the public
-- storefront's popular sort.  Customer identity and order numbers never leave
-- the server-side function.
create or replace function public.get_public_best_sellers(p_limit integer default 12)
returns table(product_id uuid, sold_quantity bigint)
language sql
security definer
set search_path = ''
as $$
  select oi.product_id, sum(oi.quantity)::bigint as sold_quantity
  from public.order_items oi
  join public.orders o on o.id = oi.order_id
  join public.products p on p.id = oi.product_id and p.status = 'active'
  where oi.product_id is not null
    and o.payment_status in ('paid', 'partially_refunded')
    and o.order_status not in ('cancelled', 'expired')
  group by oi.product_id
  order by sold_quantity desc, oi.product_id
  limit greatest(1, least(coalesce(p_limit, 12), 48));
$$;

revoke all on function public.get_public_best_sellers(integer) from public;
grant execute on function public.get_public_best_sellers(integer) to anon, authenticated;

-- Hard deletion is only available for products that have never participated in
-- an order or inventory movement.  Historical products must be archived so
-- order snapshots, refunds and audit trails remain intact.
create or replace function private.delete_admin_product(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_storage_paths text[];
  v_variant_ids uuid[];
  v_product_name text;
begin
  if not coalesce(private.can_manage_catalog(), false) then
    raise exception using errcode = '42501', message = 'Catalog role is required';
  end if;

  select p.name into v_product_name
  from public.products p
  where p.id = p_product_id;

  if v_product_name is null then
    raise exception using errcode = 'P0002', message = 'Product was not found';
  end if;

  select coalesce(array_agg(pv.id), '{}'::uuid[])
    into v_variant_ids
  from public.product_variants pv
  where pv.product_id = p_product_id;

  if exists (
    select 1
    from public.order_items oi
    where oi.product_id = p_product_id
       or oi.variant_id = any(v_variant_ids)
  ) then
    raise exception using errcode = '23503', message = 'Product has order history; archive it instead';
  end if;

  if exists (
    select 1
    from public.inventory_reservations ir
    where ir.variant_id = any(v_variant_ids)
  ) or exists (
    select 1
    from public.inventory_movements im
    where im.variant_id = any(v_variant_ids)
  ) then
    raise exception using errcode = '23503', message = 'Product has inventory history; archive it instead';
  end if;

  select coalesce(array_agg(pi.storage_path), '{}'::text[])
    into v_storage_paths
  from public.product_images pi
  where pi.product_id = p_product_id;

  delete from public.inventory_levels
  where variant_id = any(v_variant_ids);

  delete from public.product_variants
  where product_id = p_product_id;

  delete from public.products
  where id = p_product_id;

  insert into public.admin_audit_logs (admin_user_id, action, resource_type, resource_id, changed_fields)
  values (auth.uid(), 'product.delete', 'product', p_product_id, array['product']::text[]);

  return jsonb_build_object(
    'productId', p_product_id,
    'productName', v_product_name,
    'storagePaths', to_jsonb(v_storage_paths)
  );
end;
$$;

create or replace function public.delete_admin_product(p_product_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.delete_admin_product(p_product_id);
$$;

revoke all on function public.delete_admin_product(uuid) from public, anon;
grant execute on function public.delete_admin_product(uuid) to authenticated;
