-- Checkout transaction boundary.
-- The security-definer implementation stays in the private schema. The public
-- wrapper is callable only by service_role, so browser clients cannot create
-- orders, change prices, or reserve inventory directly.

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
  v_shipping_total integer := 80;
  v_grand_total integer;
  v_item_count integer;
  v_has_stock boolean := false;
  v_has_preorder boolean := false;
  v_items jsonb := '[]'::jsonb;
  v_reservation_expires_at timestamptz := now() + interval '15 minutes';
  v_email text := lower(trim(coalesce(p_payload->'customer'->>'email', '')));
  v_phone text := trim(coalesce(p_payload->'customer'->>'phone', ''));
  v_recipient_name text := trim(coalesce(p_payload->'customer'->>'recipientName', ''));
  v_postal_code text := trim(coalesce(p_payload->'customer'->>'postalCode', ''));
  v_city text := trim(coalesce(p_payload->'customer'->>'city', ''));
  v_district text := trim(coalesce(p_payload->'customer'->>'district', ''));
  v_address_line text := trim(coalesce(p_payload->'customer'->>'addressLine', ''));
  v_customer_note text := nullif(trim(coalesce(p_payload->'customer'->>'customerNote', '')), '');
  v_consent_version text := trim(coalesce(p_payload->>'consentVersion', 'terms-v1'));
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

  select count(*) into v_item_count
  from jsonb_array_elements(p_payload->'items');
  if v_item_count < 1 or v_item_count > 50 then
    raise exception using errcode = '22023', message = 'Cart item count is outside the allowed range';
  end if;

  -- Release expired holds before taking inventory locks. The aggregate update
  -- avoids subtracting only one reservation when several expire together.
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

  -- Aggregate duplicate variant lines so one checkout cannot reserve the same
  -- SKU through two separate rows and bypass the quantity check.
  for item in
    select parsed."variantId", sum(parsed.quantity)::integer as quantity
    from jsonb_to_recordset(p_payload->'items') as parsed("variantId" uuid, quantity integer)
    group by parsed."variantId"
  loop
    if item."variantId" is null or item.quantity is null or item.quantity < 1 or item.quantity > 10 then
      raise exception using errcode = '22023', message = 'Invalid variant quantity';
    end if;

    select
      pv.id,
      pv.product_id,
      pv.sku,
      pv.fulfillment_mode,
      pv.preorder_available_at,
      coalesce(pv.price_override, p.sale_price) as unit_price,
      p.name as product_name
    into variant_row
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = item."variantId"
      and pv.status = 'active'
      and pv.fulfillment_mode in ('in_stock', 'preorder')
      and p.status = 'active'
    for update of pv;

    if not found then
      raise exception using errcode = 'P0001', message = 'Product variant is no longer available';
    end if;

    select il.on_hand, il.reserved
    into inventory_row
    from public.inventory_levels il
    where il.variant_id = item."variantId"
    for update;

    if not found or item.quantity > inventory_row.on_hand - inventory_row.reserved then
      raise exception using errcode = 'P0001', message = 'Inventory is insufficient for one or more items';
    end if;

    select coalesce(jsonb_object_agg(po.name, pov.value), '{}'::jsonb)
    into selected_options
    from public.variant_option_values vov
    join public.product_option_values pov on pov.id = vov.option_value_id
    join public.product_options po on po.id = pov.option_id
    where vov.variant_id = item."variantId";

    v_subtotal := v_subtotal + (variant_row.unit_price * item.quantity);
    v_has_stock := v_has_stock or variant_row.fulfillment_mode = 'in_stock';
    v_has_preorder := v_has_preorder or variant_row.fulfillment_mode = 'preorder';
    v_items := v_items || jsonb_build_array(jsonb_build_object(
      'variantId', variant_row.id,
      'productId', variant_row.product_id,
      'productName', variant_row.product_name,
      'sku', variant_row.sku,
      'unitPrice', variant_row.unit_price,
      'quantity', item.quantity,
      'fulfillmentMode', variant_row.fulfillment_mode,
      'preorderAvailableAt', variant_row.preorder_available_at,
      'selectedOptions', selected_options
    ));
  end loop;

  v_grand_total := v_subtotal + v_shipping_total;
  v_order_number := 'MR' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.orders (
    id, order_number, email, phone, recipient_name, postal_code, city, district,
    address_line, currency, subtotal, discount_total, shipping_total, grand_total,
    payment_status, fulfillment_status, order_status, stock_mode, customer_note
  ) values (
    v_order_id,
    v_order_number,
    v_email,
    v_phone,
    v_recipient_name,
    v_postal_code,
    v_city,
    v_district,
    v_address_line,
    'TWD',
    v_subtotal,
    0,
    v_shipping_total,
    v_grand_total,
    'pending',
    case when v_has_preorder then 'awaiting_stock' else 'processing' end,
    'pending_payment',
    case when v_has_stock and v_has_preorder then 'mixed' when v_has_preorder then 'preorder' else 'in_stock' end,
    v_customer_note
  );

  for line in
    select * from jsonb_to_recordset(v_items) as parsed(
      "variantId" uuid,
      "productId" uuid,
      "productName" text,
      sku text,
      "unitPrice" integer,
      quantity integer,
      "fulfillmentMode" text,
      "preorderAvailableAt" date,
      "selectedOptions" jsonb
    )
  loop
    insert into public.order_items (
      order_id, product_id, variant_id, product_name, variant_name, sku,
      selected_options, unit_price, quantity, line_total, fulfillment_mode,
      preorder_available_at
    ) values (
      v_order_id,
      line."productId",
      line."variantId",
      line."productName",
      coalesce((select string_agg(value, '／') from jsonb_each_text(line."selectedOptions")), line.sku),
      line.sku,
      line."selectedOptions",
      line."unitPrice",
      line.quantity,
      line."unitPrice" * line.quantity,
      line."fulfillmentMode",
      line."preorderAvailableAt"
    );

    insert into public.inventory_reservations (variant_id, order_id, quantity, status, expires_at)
    values (line."variantId", v_order_id, line.quantity, 'active', v_reservation_expires_at);

    update public.inventory_levels
    set reserved = reserved + line.quantity, updated_at = now()
    where variant_id = line."variantId";
  end loop;

  insert into public.payments (
    order_id, provider, provider_payment_id, idempotency_key, amount, currency,
    status, paid_at
  ) values (
    v_order_id,
    'test',
    'test_' || p_idempotency_key,
    p_idempotency_key,
    v_grand_total,
    'TWD',
    'paid',
    now()
  );

  update public.orders
  set payment_status = 'paid', order_status = 'confirmed', updated_at = now()
  where id = v_order_id;

  insert into public.order_timeline (order_id, event_type, to_status, actor_type, note, metadata)
  values
    (v_order_id, 'checkout_created', 'confirmed', 'system', 'Test payment adapter confirmed the order.', jsonb_build_object('provider', 'test')),
    (v_order_id, 'inventory_reserved', null, 'system', 'Inventory held for 15 minutes.', jsonb_build_object('expiresAt', v_reservation_expires_at));

  insert into public.consent_records (order_id, consent_type, document_version, granted, source)
  values (v_order_id, 'terms_and_returns', v_consent_version, true, 'checkout');

  return jsonb_build_object(
    'orderId', v_order_id,
    'orderNumber', v_order_number,
    'subtotal', v_subtotal,
    'shippingTotal', v_shipping_total,
    'grandTotal', v_grand_total,
    'paymentStatus', 'paid',
    'fulfillmentStatus', case when v_has_preorder then 'awaiting_stock' else 'processing' end,
    'reservationExpiresAt', v_reservation_expires_at,
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.create_checkout_order(p_payload jsonb, p_idempotency_key text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_checkout_order(p_payload, p_idempotency_key);
$$;

revoke all on function private.create_checkout_order(jsonb, text) from public, anon, authenticated;
revoke all on function public.create_checkout_order(jsonb, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.create_checkout_order(jsonb, text) to service_role;
grant execute on function public.create_checkout_order(jsonb, text) to service_role;
