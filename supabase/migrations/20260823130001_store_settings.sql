-- V1 operational settings managed by the owner/approved staff.
-- Public checkout only receives the explicitly safe values through a security-definer RPC.

create table if not exists public.store_settings (
  id boolean primary key default true check (id = true),
  brand_name text not null default 'GYEOT' check (char_length(brand_name) between 1 and 80),
  support_email text not null default 'smartengine.tw@gmail.com' check (char_length(support_email) between 3 and 254),
  shipping_fee integer not null default 80 check (shipping_fee >= 0 and shipping_fee <= 100000),
  reservation_minutes integer not null default 15 check (reservation_minutes between 1 and 1440),
  preorder_enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.store_settings (id)
values (true)
on conflict (id) do nothing;

alter table public.store_settings enable row level security;
drop policy if exists store_settings_admin_select on public.store_settings;
drop policy if exists store_settings_admin_update on public.store_settings;
create policy store_settings_admin_select on public.store_settings
  for select to authenticated using (private.is_admin());
create policy store_settings_admin_update on public.store_settings
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

create or replace function private.get_store_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'brandName', coalesce((select s.brand_name from public.store_settings s where s.id = true), 'GYEOT'),
    'supportEmail', coalesce((select s.support_email from public.store_settings s where s.id = true), 'smartengine.tw@gmail.com'),
    'shippingFee', coalesce((select s.shipping_fee from public.store_settings s where s.id = true), 80),
    'reservationMinutes', coalesce((select s.reservation_minutes from public.store_settings s where s.id = true), 15),
    'preorderEnabled', coalesce((select s.preorder_enabled from public.store_settings s where s.id = true), true)
  );
$$;

create or replace function public.get_store_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.get_store_settings();
$$;

revoke all on function private.get_store_settings() from public, anon, authenticated;
revoke all on function public.get_store_settings() from public;
grant usage on schema private to service_role;
grant execute on function private.get_store_settings() to service_role;
grant execute on function public.get_store_settings() to anon, authenticated, service_role;

create or replace function private.preview_coupon_discount(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_coupon_code text := upper(trim(coalesce(p_payload->>'couponCode', '')));
  v_subtotal integer := 0;
  v_discount_total integer := 0;
  v_shipping_total integer := 80;
  v_preorder_enabled boolean := true;
  v_coupon record;
  item record;
  variant_row record;
  v_item_count integer;
begin
  if v_coupon_code = '' then
    raise exception using errcode = '22023', message = 'coupon_required';
  end if;
  if jsonb_typeof(p_payload->'items') <> 'array' then
    raise exception using errcode = '22023', message = 'Cart items are required';
  end if;

  select s.shipping_fee, s.preorder_enabled
  into v_shipping_total, v_preorder_enabled
  from public.store_settings s
  where s.id = true;
  v_shipping_total := coalesce(v_shipping_total, 80);
  v_preorder_enabled := coalesce(v_preorder_enabled, true);

  select count(*) into v_item_count from jsonb_array_elements(p_payload->'items');
  if v_item_count < 1 or v_item_count > 50 then
    raise exception using errcode = '22023', message = 'Cart item count is outside the allowed range';
  end if;

  for item in
    select parsed."variantId", sum(parsed.quantity)::integer as quantity
    from jsonb_to_recordset(p_payload->'items') as parsed("variantId" uuid, quantity integer)
    group by parsed."variantId"
  loop
    if item."variantId" is null or item.quantity is null or item.quantity < 1 or item.quantity > 10 then
      raise exception using errcode = '22023', message = 'Invalid variant quantity';
    end if;

    select pv.id, pv.fulfillment_mode, coalesce(pv.price_override, p.sale_price) as unit_price
    into variant_row
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = item."variantId" and pv.status = 'active'
      and pv.fulfillment_mode in ('in_stock', 'preorder') and p.status = 'active';

    if not found then
      raise exception using errcode = 'P0001', message = 'Product variant is no longer available';
    end if;
    if variant_row.fulfillment_mode = 'preorder' and not v_preorder_enabled then
      raise exception using errcode = '22023', message = 'preorder_disabled';
    end if;

    v_subtotal := v_subtotal + (variant_row.unit_price * item.quantity);
  end loop;

  select c.* into v_coupon
  from public.coupons c
  where c.code = v_coupon_code;

  if not found
    or not v_coupon.is_active
    or (v_coupon.starts_at is not null and now() < v_coupon.starts_at)
    or (v_coupon.ends_at is not null and now() >= v_coupon.ends_at)
    or (v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit)
    or v_subtotal < v_coupon.minimum_subtotal then
    raise exception using errcode = '22023', message = 'coupon_invalid';
  end if;

  if v_coupon.discount_type = 'percent' then
    v_discount_total := least(v_subtotal, floor(v_subtotal * v_coupon.discount_value / 100.0)::integer);
  else
    v_discount_total := least(v_subtotal, v_coupon.discount_value);
  end if;

  return jsonb_build_object(
    'couponCode', v_coupon_code,
    'discountType', v_coupon.discount_type,
    'discountValue', v_coupon.discount_value,
    'subtotal', v_subtotal,
    'discountTotal', v_discount_total,
    'shippingTotal', v_shipping_total,
    'grandTotal', v_subtotal - v_discount_total + v_shipping_total,
    'minimumSubtotal', v_coupon.minimum_subtotal
  );
end;
$$;

create or replace function private.create_checkout_order(
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing_order_id uuid;
  v_order_id uuid := gen_random_uuid();
  v_order_number text;
  v_subtotal integer := 0;
  v_discount_total integer := 0;
  v_shipping_total integer := 80;
  v_reservation_minutes integer := 15;
  v_preorder_enabled boolean := true;
  v_grand_total integer;
  v_item_count integer;
  v_has_stock boolean := false;
  v_has_preorder boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_reservation_expires_at timestamptz;
  v_email text := lower(trim(coalesce(p_payload->'customer'->>'email', '')));
  v_phone text := trim(coalesce(p_payload->'customer'->>'phone', ''));
  v_recipient_name text := trim(coalesce(p_payload->'customer'->>'recipientName', ''));
  v_postal_code text := trim(coalesce(p_payload->'customer'->>'postalCode', ''));
  v_city text := trim(coalesce(p_payload->'customer'->>'city', ''));
  v_district text := trim(coalesce(p_payload->'customer'->>'district', ''));
  v_address_line text := trim(coalesce(p_payload->'customer'->>'addressLine', ''));
  v_customer_note text := nullif(trim(coalesce(p_payload->'customer'->>'customerNote', '')), '');
  v_consent_version text := trim(coalesce(p_payload->>'consentVersion', 'terms-v1'));
  v_coupon_code text := upper(trim(coalesce(p_payload->>'couponCode', '')));
  v_coupon_id uuid;
  v_coupon record;
  item record;
  line record;
  selected_options jsonb;
  variant_row record;
  inventory_row record;
begin
  if length(trim(coalesce(p_idempotency_key, ''))) < 16 then
    raise exception using errcode = '22023', message = 'idempotency_key is required';
  end if;

  if coalesce(p_payload->>'paymentProvider', '') <> 'test' then
    raise exception using errcode = '22023', message = 'Only the test payment adapter is enabled in V1';
  end if;

  select p.order_id into v_existing_order_id
  from public.payments p
  where p.idempotency_key = p_idempotency_key;

  if v_existing_order_id is not null then
    return (
      select jsonb_build_object(
        'orderId', o.id,
        'orderNumber', o.order_number,
        'subtotal', o.subtotal,
        'discountTotal', o.discount_total,
        'couponCode', o.coupon_code,
        'shippingTotal', o.shipping_total,
        'grandTotal', o.grand_total,
        'paymentStatus', o.payment_status,
        'fulfillmentStatus', o.fulfillment_status,
        'reservationExpiresAt', (
          select max(ir.expires_at)
          from public.inventory_reservations ir
          where ir.order_id = o.id and ir.status = 'active'
        ),
        'idempotentReplay', true
      )
      from public.orders o
      where o.id = v_existing_order_id
    );
  end if;

  select s.shipping_fee, s.reservation_minutes, s.preorder_enabled
  into v_shipping_total, v_reservation_minutes, v_preorder_enabled
  from public.store_settings s
  where s.id = true;
  v_shipping_total := coalesce(v_shipping_total, 80);
  v_reservation_minutes := coalesce(v_reservation_minutes, 15);
  v_preorder_enabled := coalesce(v_preorder_enabled, true);
  v_reservation_expires_at := now() + make_interval(mins => v_reservation_minutes);

  if v_email = '' or length(v_email) > 254 or position('@' in v_email) < 2 then
    raise exception using errcode = '22023', message = 'Valid email is required';
  end if;
  if v_phone !~ '^09[0-9]{8}$' then
    raise exception using errcode = '22023', message = 'Valid Taiwan mobile number is required';
  end if;
  if v_recipient_name = '' or v_postal_code = '' or v_city = '' or v_district = '' or v_address_line = '' then
    raise exception using errcode = '22023', message = 'Complete delivery information is required';
  end if;
  if jsonb_typeof(p_payload->'items') <> 'array' then
    raise exception using errcode = '22023', message = 'Cart items are required';
  end if;

  select count(*) into v_item_count from jsonb_array_elements(p_payload->'items');
  if v_item_count < 1 or v_item_count > 50 then
    raise exception using errcode = '22023', message = 'Cart item count is outside the allowed range';
  end if;

  with expired as (
    select variant_id, sum(quantity)::integer as quantity
    from public.inventory_reservations
    where status = 'active' and expires_at <= now()
    group by variant_id
  )
  update public.inventory_levels il
  set reserved = greatest(0, il.reserved - expired.quantity), updated_at = now()
  from expired
  where il.variant_id = expired.variant_id;

  update public.inventory_reservations
  set status = 'expired', released_at = now()
  where status = 'active' and expires_at <= now();

  for item in
    select parsed."variantId", sum(parsed.quantity)::integer as quantity
    from jsonb_to_recordset(p_payload->'items') as parsed("variantId" uuid, quantity integer)
    group by parsed."variantId"
  loop
    if item."variantId" is null or item.quantity is null or item.quantity < 1 or item.quantity > 10 then
      raise exception using errcode = '22023', message = 'Invalid variant quantity';
    end if;

    select pv.id, pv.product_id, pv.sku, pv.fulfillment_mode, pv.preorder_available_at,
      coalesce(pv.price_override, p.sale_price) as unit_price, p.name as product_name
    into variant_row
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = item."variantId" and pv.status = 'active'
      and pv.fulfillment_mode in ('in_stock', 'preorder') and p.status = 'active'
    for update of pv;

    if not found then
      raise exception using errcode = 'P0001', message = 'Product variant is no longer available';
    end if;
    if variant_row.fulfillment_mode = 'preorder' and not v_preorder_enabled then
      raise exception using errcode = '22023', message = 'preorder_disabled';
    end if;

    select il.on_hand, il.reserved into inventory_row
    from public.inventory_levels il where il.variant_id = item."variantId" for update;

    if not found or item.quantity > inventory_row.on_hand - inventory_row.reserved then
      raise exception using errcode = 'P0001', message = 'Inventory is insufficient for one or more items';
    end if;

    select coalesce(jsonb_object_agg(po.name, pov.value), '{}'::jsonb) into selected_options
    from public.variant_option_values vov
    join public.product_option_values pov on pov.id = vov.option_value_id
    join public.product_options po on po.id = pov.option_id
    where vov.variant_id = item."variantId";

    v_subtotal := v_subtotal + (variant_row.unit_price * item.quantity);
    v_has_stock := v_has_stock or variant_row.fulfillment_mode = 'in_stock';
    v_has_preorder := v_has_preorder or variant_row.fulfillment_mode = 'preorder';
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'variantId', variant_row.id, 'productId', variant_row.product_id,
      'productName', variant_row.product_name, 'sku', variant_row.sku,
      'unitPrice', variant_row.unit_price, 'quantity', item.quantity,
      'fulfillmentMode', variant_row.fulfillment_mode,
      'preorderAvailableAt', variant_row.preorder_available_at,
      'selectedOptions', selected_options
    ));
  end loop;

  if v_coupon_code <> '' then
    select c.* into v_coupon from public.coupons c where c.code = v_coupon_code for update;
    if not found
      or not v_coupon.is_active
      or (v_coupon.starts_at is not null and now() < v_coupon.starts_at)
      or (v_coupon.ends_at is not null and now() >= v_coupon.ends_at)
      or (v_coupon.usage_limit is not null and v_coupon.usage_count >= v_coupon.usage_limit)
      or v_subtotal < v_coupon.minimum_subtotal then
      raise exception using errcode = '22023', message = 'coupon_invalid';
    end if;

    if v_coupon.discount_type = 'percent' then
      v_discount_total := least(v_subtotal, floor(v_subtotal * v_coupon.discount_value / 100.0)::integer);
    else
      v_discount_total := least(v_subtotal, v_coupon.discount_value);
    end if;
    v_coupon_id := v_coupon.id;
    update public.coupons set usage_count = usage_count + 1, updated_at = now() where id = v_coupon.id;
  end if;

  v_grand_total := v_subtotal - v_discount_total + v_shipping_total;
  v_order_number := 'MR' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    id, order_number, email, phone, recipient_name, postal_code, city, district,
    address_line, currency, subtotal, discount_total, coupon_id, coupon_code,
    shipping_total, grand_total, payment_status, fulfillment_status, order_status,
    stock_mode, customer_note
  ) values (
    v_order_id, v_order_number, v_email, v_phone, v_recipient_name, v_postal_code,
    v_city, v_district, v_address_line, 'TWD', v_subtotal, v_discount_total,
    v_coupon_id, nullif(v_coupon_code, ''), v_shipping_total, v_grand_total,
    'pending', case when v_has_preorder then 'awaiting_stock' else 'processing' end,
    'pending_payment', case when v_has_stock and v_has_preorder then 'mixed'
      when v_has_preorder then 'preorder' else 'in_stock' end, v_customer_note
  );

  for line in
    select * from jsonb_to_recordset(v_items) as parsed(
      "variantId" uuid, "productId" uuid, "productName" text, sku text,
      "unitPrice" integer, quantity integer, "fulfillmentMode" text,
      "preorderAvailableAt" date, "selectedOptions" jsonb
    )
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_name, sku,
      selected_options, unit_price, quantity, line_total, fulfillment_mode,
      preorder_available_at
    ) values (
      v_order_id, line."productId", line."variantId", line."productName",
      coalesce((select string_agg(value, '／') from jsonb_each_text(line."selectedOptions")), line.sku),
      line.sku, line."selectedOptions", line."unitPrice", line.quantity,
      line."unitPrice" * line.quantity, line."fulfillmentMode", line."preorderAvailableAt"
    );

    insert into public.inventory_reservations (variant_id, order_id, quantity, status, expires_at)
    values (line."variantId", v_order_id, line.quantity, 'active', v_reservation_expires_at);
    update public.inventory_levels set reserved = reserved + line.quantity, updated_at = now()
    where variant_id = line."variantId";
  end loop;

  insert into public.payments (
    order_id, provider, provider_payment_id, idempotency_key, amount, currency, status, paid_at
  ) values (v_order_id, 'test', 'test_' || p_idempotency_key, p_idempotency_key,
    v_grand_total, 'TWD', 'paid', now());

  update public.orders set payment_status = 'paid', order_status = 'confirmed', updated_at = now()
  where id = v_order_id;

  insert into public.order_timeline (order_id, event_type, to_status, actor_type, note, metadata)
  values
    (v_order_id, 'checkout_created', 'confirmed', 'system', 'Test payment adapter confirmed the order.', jsonb_build_object('provider', 'test', 'couponCode', nullif(v_coupon_code, ''))),
    (v_order_id, 'inventory_reserved', null, 'system', format('Inventory held for %s minutes.', v_reservation_minutes), jsonb_build_object('expiresAt', v_reservation_expires_at));

  insert into public.consent_records (order_id, consent_type, document_version, granted, source)
  values (v_order_id, 'terms_and_returns', v_consent_version, true, 'checkout');

  return jsonb_build_object(
    'orderId', v_order_id, 'orderNumber', v_order_number, 'subtotal', v_subtotal,
    'discountTotal', v_discount_total, 'couponCode', nullif(v_coupon_code, ''),
    'shippingTotal', v_shipping_total, 'grandTotal', v_grand_total,
    'paymentStatus', 'paid',
    'fulfillmentStatus', case when v_has_preorder then 'awaiting_stock' else 'processing' end,
    'reservationExpiresAt', v_reservation_expires_at, 'idempotentReplay', false
  );
end;
$$;

create or replace function public.preview_coupon_discount(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.preview_coupon_discount(p_payload);
$$;

create or replace function public.create_checkout_order(p_payload jsonb, p_idempotency_key text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_checkout_order(p_payload, p_idempotency_key);
$$;

revoke all on function private.preview_coupon_discount(jsonb) from public, anon, authenticated;
revoke all on function public.preview_coupon_discount(jsonb) from public, anon, authenticated;
revoke all on function private.create_checkout_order(jsonb, text) from public, anon, authenticated;
revoke all on function public.create_checkout_order(jsonb, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.preview_coupon_discount(jsonb) to service_role;
grant execute on function public.preview_coupon_discount(jsonb) to service_role;
grant execute on function private.create_checkout_order(jsonb, text) to service_role;
grant execute on function public.create_checkout_order(jsonb, text) to service_role;
