-- A public product must be taken off sale before hard deletion. The history
-- checks from 20260825210000 remain in place, so products with order or
-- inventory history still have to be archived instead of deleted.
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
  v_product_status text;
begin
  if not coalesce(private.can_manage_catalog(), false) then
    raise exception using errcode = '42501', message = 'Catalog role is required';
  end if;

  select p.name, p.status
    into v_product_name, v_product_status
  from public.products p
  where p.id = p_product_id;

  if v_product_name is null then
    raise exception using errcode = 'P0002', message = 'Product was not found';
  end if;

  if coalesce(v_product_status, '') not in ('draft', 'archived') then
    raise exception using errcode = 'P0001', message = 'Only draft or archived products may be deleted';
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

comment on function private.delete_admin_product(uuid) is
  'Hard delete is limited to draft or archived products with no order or inventory history.';
