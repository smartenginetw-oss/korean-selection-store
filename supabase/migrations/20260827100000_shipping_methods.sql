-- V1 shipping methods: home delivery plus 7-ELEVEN and FamilyMart pickup.
-- The existing checkout transaction remains the source of truth for prices and
-- inventory. This adapter normalises convenience-store orders into that
-- transaction, then records the selected store on the shipment snapshot.

alter table public.store_settings
  add column if not exists cvs_711_fee integer not null default 60
    check (cvs_711_fee >= 0 and cvs_711_fee <= 100000),
  add column if not exists cvs_family_fee integer not null default 60
    check (cvs_family_fee >= 0 and cvs_family_fee <= 100000);

alter table public.orders drop constraint if exists orders_shipping_method_check;
alter table public.orders add constraint orders_shipping_method_check
  check (shipping_method in ('home_delivery', 'cvs_711', 'cvs_family'));

alter table public.shipments
  alter column carrier drop not null,
  alter column tracking_number drop not null;

alter table public.shipments
  add column if not exists shipping_method text not null default 'home_delivery',
  add column if not exists provider text not null default 'mock',
  add column if not exists recipient_name text,
  add column if not exists recipient_phone text,
  add column if not exists postal_code text,
  add column if not exists city text,
  add column if not exists district text,
  add column if not exists address_line text,
  add column if not exists store_code text,
  add column if not exists store_name text,
  add column if not exists store_address text,
  add column if not exists shipping_fee integer not null default 0;

alter table public.shipments drop constraint if exists shipments_status_check;
alter table public.shipments add constraint shipments_status_check
  check (status in ('pending', 'ready', 'preparing', 'shipped', 'in_transit', 'delivered', 'returned', 'cancelled', 'exception'));
alter table public.shipments drop constraint if exists shipments_shipping_method_check;
alter table public.shipments add constraint shipments_shipping_method_check
  check (shipping_method in ('home_delivery', 'cvs_711', 'cvs_family'));

-- Admin order lists commonly filter by delivery method while sorting by newest
-- first. Keep that query bounded as the store grows.
create index if not exists orders_shipping_method_created_idx
  on public.orders(shipping_method, created_at desc);

create or replace function private.get_store_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'brandName', coalesce((select s.brand_name from public.store_settings s where s.id = true), 'GYEOT'),
    'supportEmail', coalesce((select s.support_email from public.store_settings s where s.id = true), 'gyeot.official@gmail.com'),
    'shippingFee', coalesce((select s.shipping_fee from public.store_settings s where s.id = true), 80),
    'cvs711Fee', coalesce((select s.cvs_711_fee from public.store_settings s where s.id = true), 60),
    'cvsFamilyFee', coalesce((select s.cvs_family_fee from public.store_settings s where s.id = true), 60),
    'reservationMinutes', coalesce((select s.reservation_minutes from public.store_settings s where s.id = true), 15),
    'preorderEnabled', coalesce((select s.preorder_enabled from public.store_settings s where s.id = true), true),
    'instagramUrl', (select s.instagram_url from public.store_settings s where s.id = true),
    'threadsUrl', (select s.threads_url from public.store_settings s where s.id = true),
    'facebookUrl', (select s.facebook_url from public.store_settings s where s.id = true),
    'lineOfficialUrl', (select s.line_official_url from public.store_settings s where s.id = true)
  );
$$;

revoke all on function private.get_store_settings() from public, anon, authenticated;
grant execute on function private.get_store_settings() to service_role;

create or replace function private.shipping_fee_for_method(p_method text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  method text := lower(trim(coalesce(p_method, 'home_delivery')));
  fee integer;
begin
  if method not in ('home_delivery', 'cvs_711', 'cvs_family') then
    raise exception using errcode = '22023', message = 'Invalid shipping method';
  end if;
  select case method
    when 'cvs_711' then s.cvs_711_fee
    when 'cvs_family' then s.cvs_family_fee
    else s.shipping_fee
  end into fee
  from public.store_settings s
  where s.id = true;
  return coalesce(fee, case method when 'home_delivery' then 80 else 60 end);
end;
$$;

revoke all on function private.shipping_fee_for_method(text) from public, anon, authenticated;
grant execute on function private.shipping_fee_for_method(text) to service_role;

create or replace function private.preview_coupon_discount_with_shipping(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  method text := lower(trim(coalesce(p_payload->>'shippingMethod', 'home_delivery')));
  result jsonb;
  previous_shipping integer;
  next_shipping integer;
begin
  if method not in ('home_delivery', 'cvs_711', 'cvs_family') then
    raise exception using errcode = '22023', message = 'Invalid shipping method';
  end if;
  result := private.preview_coupon_discount(p_payload);
  previous_shipping := coalesce((result->>'shippingTotal')::integer, 0);
  next_shipping := private.shipping_fee_for_method(method);
  return result || jsonb_build_object(
    'shippingTotal', next_shipping,
    'grandTotal', coalesce((result->>'grandTotal')::integer, 0) - previous_shipping + next_shipping
  );
end;
$$;

create or replace function public.preview_coupon_discount(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.preview_coupon_discount_with_shipping(p_payload);
$$;

revoke all on function private.preview_coupon_discount_with_shipping(jsonb) from public, anon, authenticated;
revoke all on function public.preview_coupon_discount(jsonb) from public, anon, authenticated;
grant execute on function private.preview_coupon_discount_with_shipping(jsonb) to service_role;
grant execute on function public.preview_coupon_discount(jsonb) to service_role;

create or replace function private.create_checkout_order_with_shipping(
  p_payload jsonb,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  method text := lower(trim(coalesce(p_payload->>'shippingMethod', 'home_delivery')));
  payload jsonb := p_payload;
  result jsonb;
  order_id uuid;
  current_order public.orders%rowtype;
  store_code text := trim(coalesce(p_payload->'customer'->>'storeCode', ''));
  store_name text := trim(coalesce(p_payload->'customer'->>'storeName', ''));
  store_address text := trim(coalesce(p_payload->'customer'->>'storeAddress', ''));
  shipping_fee integer;
  adjusted_total integer;
  existing_method text;
  has_shipment boolean;
begin
  if method not in ('home_delivery', 'cvs_711', 'cvs_family') then
    raise exception using errcode = '22023', message = 'Invalid shipping method';
  end if;
  if method <> 'home_delivery' and (store_code = '' or store_name = '' or store_address = '') then
    raise exception using errcode = '22023', message = 'Complete convenience store information is required';
  end if;
  shipping_fee := private.shipping_fee_for_method(method);

  -- The existing transaction requires address columns for every order. For a
  -- pickup order we store a clearly marked snapshot in those legacy columns;
  -- the shipment row contains the actual store address and code.
  if method <> 'home_delivery' then
    payload := jsonb_set(payload, '{shippingMethod}', '"home_delivery"'::jsonb, true);
    payload := jsonb_set(payload, '{customer,postalCode}', to_jsonb('000'::text), true);
    payload := jsonb_set(payload, '{customer,city}', to_jsonb('超商取貨'::text), true);
    payload := jsonb_set(payload, '{customer,district}', to_jsonb(method), true);
    payload := jsonb_set(payload, '{customer,addressLine}', to_jsonb(store_address), true);
  end if;

  result := private.create_checkout_order(payload, p_idempotency_key);
  order_id := nullif(result ->> 'orderId', '')::uuid;
  if order_id is null then
    raise exception using errcode = 'P0002', message = 'Checkout order was not created';
  end if;

  select * into current_order from public.orders where public.orders.id = order_id for update;
  existing_method := coalesce(current_order.shipping_method, 'home_delivery');
  if method = 'home_delivery' and existing_method <> 'home_delivery' then
    raise exception using errcode = '22023', message = 'Idempotency key belongs to another shipping method';
  end if;
  if method <> 'home_delivery' and existing_method <> 'home_delivery' and existing_method <> method then
    raise exception using errcode = '22023', message = 'Idempotency key belongs to another shipping method';
  end if;

  adjusted_total := current_order.grand_total - current_order.shipping_total + shipping_fee;
  update public.orders
  set shipping_method = method,
      shipping_total = shipping_fee,
      grand_total = adjusted_total,
      updated_at = now()
  where public.orders.id = current_order.id;

  update public.payments as p
  set amount = adjusted_total, updated_at = now()
  where p.order_id = current_order.id and p.idempotency_key = p_idempotency_key;

  select exists(select 1 from public.shipments s where s.order_id = current_order.id and s.shipping_method = method)
  into has_shipment;
  if not has_shipment then
    insert into public.shipments (
      order_id, carrier, tracking_number, shipping_method, provider,
      recipient_name, recipient_phone, postal_code, city, district, address_line,
      store_code, store_name, store_address, shipping_fee, status
    ) values (
      order_id,
      case method when 'cvs_711' then '7-ELEVEN' when 'cvs_family' then '全家' else '宅配' end,
      null, method, 'mock',
      nullif(trim(coalesce(p_payload->'customer'->>'recipientName', '')), ''),
      nullif(trim(coalesce(p_payload->'customer'->>'phone', '')), ''),
      nullif(trim(coalesce(p_payload->'customer'->>'postalCode', '')), ''),
      nullif(trim(coalesce(p_payload->'customer'->>'city', '')), ''),
      nullif(trim(coalesce(p_payload->'customer'->>'district', '')), ''),
      nullif(trim(coalesce(p_payload->'customer'->>'addressLine', '')), ''),
      nullif(store_code, ''), nullif(store_name, ''), nullif(store_address, ''), shipping_fee, 'pending'
    );
  end if;

  return result || jsonb_build_object(
    'shippingMethod', method,
    'shippingTotal', shipping_fee,
    'grandTotal', adjusted_total
  );
end;
$$;

create or replace function private.create_checkout_order_for_member(
  p_payload jsonb,
  p_idempotency_key text,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  order_id uuid;
  existing_profile_id uuid;
begin
  if p_profile_id is not null and not exists (select 1 from auth.users where id = p_profile_id) then
    raise exception using errcode = '42501', message = 'Member account was not found';
  end if;
  result := private.create_checkout_order_with_shipping(p_payload, p_idempotency_key);
  order_id := nullif(result ->> 'orderId', '')::uuid;
  if p_profile_id is not null and order_id is not null then
    select o.profile_id into existing_profile_id from public.orders o where o.id = order_id for update;
    if existing_profile_id is not null and existing_profile_id <> p_profile_id then
      raise exception using errcode = '42501', message = 'This idempotent order belongs to another member';
    end if;
    if existing_profile_id is null then
      update public.orders set profile_id = p_profile_id, updated_at = now()
      where public.orders.id = order_id and profile_id is null;
    end if;
  end if;
  return result;
end;
$$;

create or replace function public.create_checkout_order(p_payload jsonb, p_idempotency_key text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_checkout_order_with_shipping(p_payload, p_idempotency_key);
$$;

revoke all on function private.create_checkout_order_with_shipping(jsonb, text) from public, anon, authenticated;
revoke all on function private.create_checkout_order_for_member(jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.create_checkout_order(jsonb, text) from public, anon, authenticated;
revoke all on function public.create_checkout_order_for_member(jsonb, text, uuid) from public, anon, authenticated;
grant execute on function private.create_checkout_order_with_shipping(jsonb, text) to service_role;
grant execute on function private.create_checkout_order_for_member(jsonb, text, uuid) to service_role;
grant execute on function public.create_checkout_order(jsonb, text) to service_role;
grant execute on function public.create_checkout_order_for_member(jsonb, text, uuid) to service_role;

-- Admins can maintain the carrier lifecycle independently from the order's
-- payment state. Marking a shipment as shipped/delivered delegates to the
-- existing fulfillment transaction so inventory is committed exactly once.
create or replace function private.update_admin_order_shipment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := nullif(trim(coalesce(p_payload->>'orderId', '')), '')::uuid;
  v_status text := lower(trim(coalesce(p_payload->>'shipmentStatus', 'pending')));
  v_requested_fulfillment text := lower(trim(coalesce(p_payload->>'fulfillmentStatus', '')));
  v_carrier text := nullif(trim(coalesce(p_payload->>'carrier', '')), '');
  v_tracking text := nullif(trim(coalesce(p_payload->>'trackingNumber', '')), '');
  v_note text := nullif(trim(coalesce(p_payload->>'note', '')), '');
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_previous_shipment_status text;
  v_target_fulfillment text;
  v_fulfillment_result jsonb := '{}'::jsonb;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Admin role is required';
  end if;
  if v_order_id is null then
    raise exception using errcode = '22023', message = 'Order id is required';
  end if;
  if v_status not in ('pending', 'ready', 'preparing', 'shipped', 'in_transit', 'delivered', 'returned', 'cancelled', 'exception') then
    raise exception using errcode = '22023', message = 'Shipment status is invalid';
  end if;
  if v_requested_fulfillment <> '' and v_requested_fulfillment not in ('unfulfilled', 'awaiting_stock', 'processing', 'shipped', 'delivered', 'cancelled') then
    raise exception using errcode = '22023', message = 'Fulfillment status is invalid';
  end if;

  select * into v_order
  from public.orders
  where public.orders.id = v_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order was not found';
  end if;

  select * into v_shipment
  from public.shipments
  where public.shipments.order_id = v_order_id
  order by created_at desc
  limit 1
  for update;

  v_carrier := coalesce(v_carrier, v_shipment.carrier);
  v_tracking := coalesce(v_tracking, v_shipment.tracking_number);
  v_previous_shipment_status := v_shipment.status;
  if v_status in ('shipped', 'in_transit', 'delivered') then
    if v_order.payment_status <> 'paid' then
      raise exception using errcode = '22023', message = 'Only paid orders can be shipped';
    end if;
    if v_carrier is null or v_tracking is null then
      raise exception using errcode = '22023', message = 'Carrier and tracking number are required before shipping';
    end if;
  end if;
  if v_order.fulfillment_status = 'cancelled' and v_status <> 'cancelled' then
    raise exception using errcode = '22023', message = '已取消訂單不可重新啟用配送';
  end if;
  if v_shipment.status in ('delivered', 'returned', 'cancelled') and v_status not in (v_shipment.status, 'returned', 'cancelled') then
    raise exception using errcode = '22023', message = '已完成或取消的配送不可退回前一狀態';
  end if;

  v_target_fulfillment := case
    when v_status = 'delivered' then 'delivered'
    when v_status in ('shipped', 'in_transit') then 'shipped'
    when v_requested_fulfillment <> '' and v_requested_fulfillment <> v_order.fulfillment_status then v_requested_fulfillment
    else null
  end;
  if v_target_fulfillment is not null then
    v_fulfillment_result := private.update_admin_order_fulfillment(jsonb_build_object(
      'orderId', v_order_id,
      'fulfillmentStatus', v_target_fulfillment,
      'carrier', v_carrier,
      'trackingNumber', v_tracking,
      'note', v_note
    ));
    -- The fulfillment function may create the first shipment row. Refresh the
    -- snapshot before deciding whether this function should insert or update.
    select * into v_shipment
    from public.shipments
    where public.shipments.order_id = v_order_id
    order by created_at desc
    limit 1
    for update;
  end if;

  if v_shipment.id is null then
    insert into public.shipments (
      order_id, carrier, tracking_number, shipping_method, provider,
      recipient_name, recipient_phone, postal_code, city, district, address_line,
      shipping_fee, status, shipped_at, delivered_at
    ) values (
      v_order_id, v_carrier, v_tracking, v_order.shipping_method, 'mock',
      v_order.recipient_name, v_order.phone, v_order.postal_code, v_order.city,
      v_order.district, v_order.address_line, v_order.shipping_total, v_status,
      case when v_status in ('shipped', 'in_transit', 'delivered') then now() else null end,
      case when v_status = 'delivered' then now() else null end
    ) returning * into v_shipment;
  else
    update public.shipments
    set carrier = coalesce(v_carrier, carrier),
        tracking_number = coalesce(v_tracking, tracking_number),
        status = v_status,
        shipped_at = case when v_status in ('shipped', 'in_transit', 'delivered') then coalesce(shipped_at, now()) else shipped_at end,
        delivered_at = case when v_status = 'delivered' then coalesce(delivered_at, now()) else delivered_at end,
        updated_at = now()
    where public.shipments.id = v_shipment.id
    returning * into v_shipment;
  end if;

  insert into public.order_timeline (
    order_id, event_type, from_status, to_status, actor_type, actor_user_id, note, metadata
  ) values (
    v_order_id, 'shipment_status_changed', v_previous_shipment_status, v_status, 'admin', auth.uid(), v_note,
    jsonb_build_object('carrier', v_shipment.carrier, 'trackingNumber', v_shipment.tracking_number)
  );

  return jsonb_build_object(
    'orderId', v_order_id,
    'fulfillmentStatus', coalesce(v_fulfillment_result->>'fulfillmentStatus', v_order.fulfillment_status),
    'shipmentStatus', v_status,
    'shipmentId', v_shipment.id,
    'trackingNumber', v_shipment.tracking_number
  );
end;
$$;

create or replace function public.update_admin_order_shipment(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_admin_order_shipment(p_payload);
$$;

revoke all on function private.update_admin_order_shipment(jsonb) from public, anon, authenticated;
revoke all on function public.update_admin_order_shipment(jsonb) from public, anon, authenticated;
grant execute on function public.update_admin_order_shipment(jsonb) to authenticated;
