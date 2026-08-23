-- Admin product update transaction.
-- Existing variants are kept (and marked inactive when removed from the
-- editor) so historical order and inventory references remain valid.

create or replace function private.update_admin_product(p_product_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name text := trim(coalesce(p_payload->>'name', ''));
  v_slug text := lower(trim(coalesce(p_payload->>'slug', '')));
  v_description text := trim(coalesce(p_payload->>'description', ''));
  v_category_slug text := lower(trim(coalesce(p_payload->>'category', '')));
  v_status text := lower(trim(coalesce(p_payload->>'status', 'draft')));
  v_sale_price integer := nullif(trim(coalesce(p_payload->>'salePrice', '')), '')::integer;
  v_original_price integer := nullif(trim(coalesce(p_payload->>'originalPrice', '')), '')::integer;
  v_cost_price integer := nullif(trim(coalesce(p_payload->>'costPrice', '')), '')::integer;
  v_category_id uuid;
  v_variant_id uuid;
  v_linked_value_id uuid;
  v_existing_variant_id uuid;
  v_reserved integer;
  v_option_position integer := 0;
  v_value_position integer;
  v_sku text;
  v_mode text;
  v_stock integer;
  v_option_name text;
  v_option_value text;
  v_option_entry jsonb;
  v_value_entry jsonb;
  v_variant_entry jsonb;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Admin role is required';
  end if;

  if p_product_id is null then
    raise exception using errcode = '22023', message = 'Product id is required';
  end if;
  if not exists (select 1 from public.products where id = p_product_id) then
    raise exception using errcode = 'P0002', message = 'Product was not found';
  end if;
  if v_name = '' or length(v_name) > 160 or v_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception using errcode = '22023', message = 'Product name or slug is invalid';
  end if;
  if v_sale_price is null or v_sale_price <= 0 then
    raise exception using errcode = '22023', message = 'A positive sale price is required';
  end if;
  if v_original_price is not null and v_original_price < v_sale_price then
    raise exception using errcode = '22023', message = 'Original price must not be lower than sale price';
  end if;
  if v_cost_price is not null and v_cost_price < 0 then
    raise exception using errcode = '22023', message = 'Cost price cannot be negative';
  end if;
  if v_status not in ('draft', 'active') then
    raise exception using errcode = '22023', message = 'Product status is invalid';
  end if;
  if jsonb_typeof(p_payload->'options') <> 'array' or jsonb_array_length(p_payload->'options') < 1 then
    raise exception using errcode = '22023', message = 'At least one product option is required';
  end if;
  if jsonb_typeof(p_payload->'variants') <> 'array' or jsonb_array_length(p_payload->'variants') < 1 then
    raise exception using errcode = '22023', message = 'At least one product variant is required';
  end if;

  select id into v_category_id
  from public.categories
  where slug = v_category_slug and is_active = true;
  if v_category_id is null then
    raise exception using errcode = '22023', message = 'An active category is required';
  end if;

  update public.products
  set name = v_name,
      slug = v_slug,
      description = v_description,
      original_price = v_original_price,
      sale_price = v_sale_price,
      cost_price = v_cost_price,
      status = v_status,
      tags = array[v_category_slug]::text[],
      published_at = case when v_status = 'active' then coalesce(published_at, now()) else null end,
      archived_at = null,
      updated_at = now()
  where id = p_product_id;

  delete from public.product_categories where product_id = p_product_id;
  insert into public.product_categories (product_id, category_id, is_primary)
  values (p_product_id, v_category_id, true);

  -- Rebuild option values, but preserve variant ids for order history.
  delete from public.variant_option_values
  where variant_id in (select id from public.product_variants where product_id = p_product_id);
  delete from public.product_options where product_id = p_product_id;

  -- Variants omitted from the editor remain queryable for historical orders but
  -- cannot be selected for new checkout sessions.
  update public.product_variants
  set status = 'inactive', updated_at = now()
  where product_id = p_product_id and status <> 'archived';

  for v_option_entry in select value from jsonb_array_elements(p_payload->'options') loop
    if trim(coalesce(v_option_entry->>'name', '')) = ''
      or jsonb_typeof(v_option_entry->'values') <> 'array'
      or jsonb_array_length(v_option_entry->'values') < 1 then
      raise exception using errcode = '22023', message = 'Each option needs a name and values';
    end if;

    insert into public.product_options (product_id, name, position)
    values (p_product_id, trim(v_option_entry->>'name'), v_option_position);
    v_option_position := v_option_position + 1;
    v_value_position := 0;

    for v_value_entry in select value from jsonb_array_elements(v_option_entry->'values') loop
      if trim(coalesce(v_value_entry #>> '{}', '')) = '' then
        raise exception using errcode = '22023', message = 'Option values cannot be empty';
      end if;
      insert into public.product_option_values (option_id, value, position)
      values (
        (select id from public.product_options where product_id = p_product_id and name = trim(v_option_entry->>'name')),
        trim(v_value_entry #>> '{}'),
        v_value_position
      );
      v_value_position := v_value_position + 1;
    end loop;
  end loop;

  for v_variant_entry in select value from jsonb_array_elements(p_payload->'variants') loop
    v_variant_id := nullif(trim(coalesce(v_variant_entry->>'id', '')), '')::uuid;
    v_sku := upper(trim(coalesce(v_variant_entry->>'sku', '')));
    v_mode := lower(trim(coalesce(v_variant_entry->>'fulfillmentMode', 'in_stock')));
    v_stock := nullif(trim(coalesce(v_variant_entry->>'stock', '0')), '')::integer;

    if v_sku = '' or v_mode not in ('in_stock', 'preorder') or v_stock is null or v_stock < 0 then
      raise exception using errcode = '22023', message = 'Variant SKU, mode, or stock is invalid';
    end if;

    if v_variant_id is not null then
      select id into v_existing_variant_id
      from public.product_variants
      where id = v_variant_id and product_id = p_product_id
      for update;
      if v_existing_variant_id is null then
        raise exception using errcode = '22023', message = 'Variant does not belong to this product';
      end if;

      update public.product_variants
      set sku = v_sku,
          status = 'active',
          fulfillment_mode = v_mode,
          updated_at = now()
      where id = v_variant_id;
    else
      insert into public.product_variants (product_id, sku, fulfillment_mode)
      values (p_product_id, v_sku, v_mode)
      returning id into v_variant_id;
    end if;

    select reserved into v_reserved
    from public.inventory_levels
    where variant_id = v_variant_id
    for update;

    if v_reserved is null then
      insert into public.inventory_levels (variant_id, on_hand, reserved)
      values (v_variant_id, v_stock, 0);
    else
      if v_stock < v_reserved then
        raise exception using errcode = '22023', message = 'Stock cannot be lower than reserved quantity';
      end if;
      update public.inventory_levels
      set on_hand = v_stock, updated_at = now()
      where variant_id = v_variant_id;
    end if;

    for v_option_name, v_option_value in
      select key, value from jsonb_each_text(coalesce(v_variant_entry->'options', '{}'::jsonb))
    loop
      select pov.id into v_linked_value_id
      from public.product_option_values pov
      join public.product_options po on po.id = pov.option_id
      where po.product_id = p_product_id
        and po.name = trim(v_option_name)
        and pov.value = trim(v_option_value);

      if v_linked_value_id is null then
        raise exception using errcode = '22023', message = 'Variant option value does not belong to this product';
      end if;
      insert into public.variant_option_values (variant_id, option_value_id)
      values (v_variant_id, v_linked_value_id);
      v_linked_value_id := null;
    end loop;
  end loop;

  insert into public.admin_audit_logs (
    admin_user_id, action, resource_type, resource_id, changed_fields
  ) values (
    auth.uid(),
    'product.update',
    'product',
    p_product_id,
    array['name', 'slug', 'description', 'category', 'status', 'pricing', 'options', 'variants', 'inventory']::text[]
  );

  return jsonb_build_object('id', p_product_id, 'slug', v_slug, 'name', v_name);
end;
$$;

create or replace function public.update_admin_product(p_product_id uuid, p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_admin_product(p_product_id, p_payload);
$$;

revoke all on function private.update_admin_product(uuid, jsonb) from public, anon, authenticated;
revoke all on function public.update_admin_product(uuid, jsonb) from public, anon, authenticated;
grant execute on function public.update_admin_product(uuid, jsonb) to authenticated;
