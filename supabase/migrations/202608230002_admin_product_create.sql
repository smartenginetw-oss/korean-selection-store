-- Admin product creation transaction.
-- The function validates the caller's admin role, then atomically creates the
-- product, generic options, variants, inventory, category link, and audit row.

create or replace function private.create_admin_product(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product_id uuid := gen_random_uuid();
  v_name text := trim(coalesce(p_payload->>'name', ''));
  v_slug text := lower(trim(coalesce(p_payload->>'slug', '')));
  v_description text := trim(coalesce(p_payload->>'description', ''));
  v_category_slug text := lower(trim(coalesce(p_payload->>'category', '')));
  v_status text := lower(trim(coalesce(p_payload->>'status', 'draft')));
  v_sale_price integer := nullif(trim(coalesce(p_payload->>'salePrice', '')), '')::integer;
  v_original_price integer := nullif(trim(coalesce(p_payload->>'originalPrice', '')), '')::integer;
  v_cost_price integer := nullif(trim(coalesce(p_payload->>'costPrice', '')), '')::integer;
  v_category_id uuid;
  v_option_id uuid;
  v_variant_id uuid;
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
  v_linked_value_id uuid;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Admin role is required';
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

  insert into public.products (
    id, name, slug, description, original_price, sale_price, cost_price,
    status, tags, published_at
  ) values (
    v_product_id,
    v_name,
    v_slug,
    v_description,
    v_original_price,
    v_sale_price,
    v_cost_price,
    v_status,
    array[v_category_slug]::text[],
    case when v_status = 'active' then now() else null end
  );

  insert into public.product_categories (product_id, category_id, is_primary)
  values (v_product_id, v_category_id, true);

  for v_option_entry in
    select value from jsonb_array_elements(p_payload->'options')
  loop
    v_option_name := trim(coalesce(v_option_entry->>'name', ''));
    if v_option_name = '' or jsonb_typeof(v_option_entry->'values') <> 'array' or jsonb_array_length(v_option_entry->'values') < 1 then
      raise exception using errcode = '22023', message = 'Each option needs a name and values';
    end if;

    insert into public.product_options (product_id, name, position)
    values (v_product_id, v_option_name, v_option_position)
    returning id into v_option_id;
    v_option_position := v_option_position + 1;
    v_value_position := 0;

    for v_value_entry in
      select value from jsonb_array_elements(v_option_entry->'values')
    loop
      v_option_value := trim(coalesce(v_value_entry #>> '{}', ''));
      if v_option_value = '' then
        raise exception using errcode = '22023', message = 'Option values cannot be empty';
      end if;

      insert into public.product_option_values (option_id, value, position)
      values (v_option_id, v_option_value, v_value_position);
      v_value_position := v_value_position + 1;
    end loop;
  end loop;

  for v_variant_entry in
    select value from jsonb_array_elements(p_payload->'variants')
  loop
    v_sku := upper(trim(coalesce(v_variant_entry->>'sku', '')));
    v_mode := lower(trim(coalesce(v_variant_entry->>'fulfillmentMode', 'in_stock')));
    v_stock := nullif(trim(coalesce(v_variant_entry->>'stock', '0')), '')::integer;
    if v_sku = '' or v_mode not in ('in_stock', 'preorder') or v_stock is null or v_stock < 0 then
      raise exception using errcode = '22023', message = 'Variant SKU, mode, or stock is invalid';
    end if;

    insert into public.product_variants (
      product_id, sku, fulfillment_mode, price_override, preorder_available_at
    ) values (
      v_product_id,
      v_sku,
      v_mode,
      nullif(trim(coalesce(v_variant_entry->>'priceOverride', '')), '')::integer,
      nullif(trim(coalesce(v_variant_entry->>'preorderAvailableAt', '')), '')::date
    ) returning id into v_variant_id;

    for v_option_name, v_option_value in
      select key, value from jsonb_each_text(coalesce(v_variant_entry->'options', '{}'::jsonb))
    loop
      select pov.id into v_linked_value_id
      from public.product_option_values pov
      join public.product_options po on po.id = pov.option_id
      where po.product_id = v_product_id
        and po.name = v_option_name
        and pov.value = v_option_value;

      if v_linked_value_id is null then
        raise exception using errcode = '22023', message = 'Variant option value does not belong to this product';
      end if;

      insert into public.variant_option_values (variant_id, option_value_id)
      values (v_variant_id, v_linked_value_id);
      v_linked_value_id := null;
    end loop;

    insert into public.inventory_levels (variant_id, on_hand, reserved)
    values (v_variant_id, v_stock, 0);
  end loop;

  insert into public.admin_audit_logs (
    admin_user_id, action, resource_type, resource_id, changed_fields
  ) values (
    auth.uid(),
    'product.create',
    'product',
    v_product_id,
    array['name', 'slug', 'description', 'category', 'status', 'pricing', 'options', 'variants', 'inventory']::text[]
  );

  return jsonb_build_object('id', v_product_id, 'slug', v_slug, 'name', v_name);
end;
$$;

create or replace function public.create_admin_product(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_admin_product(p_payload);
$$;

revoke all on function private.create_admin_product(jsonb) from public, anon, authenticated;
revoke all on function public.create_admin_product(jsonb) from public, anon, authenticated;
grant execute on function public.create_admin_product(jsonb) to authenticated;
