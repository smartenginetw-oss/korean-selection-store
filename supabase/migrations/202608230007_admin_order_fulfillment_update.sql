-- Atomically update an order's fulfillment status and its latest shipment.
-- The function keeps the multi-table write behind the admin authorization
-- boundary and records both a customer-facing timeline event and an audit row.
create or replace function private.update_admin_order_fulfillment(p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order_id uuid := nullif(trim(coalesce(p_payload->>'orderId', '')), '')::uuid;
  v_status text := lower(trim(coalesce(p_payload->>'fulfillmentStatus', '')));
  v_carrier text := nullif(trim(coalesce(p_payload->>'carrier', '')), '');
  v_tracking text := nullif(trim(coalesce(p_payload->>'trackingNumber', '')), '');
  v_note text := nullif(trim(coalesce(p_payload->>'note', '')), '');
  v_order public.orders%rowtype;
  v_shipment public.shipments%rowtype;
  v_shipment_id uuid;
  v_shipment_status text;
begin
  if not coalesce(private.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Admin role is required';
  end if;

  if v_order_id is null then
    raise exception using errcode = '22023', message = 'Order id is required';
  end if;

  if v_status not in ('unfulfilled', 'awaiting_stock', 'processing', 'shipped', 'delivered', 'cancelled') then
    raise exception using errcode = '22023', message = 'Fulfillment status is invalid';
  end if;

  if (v_carrier is null) <> (v_tracking is null) then
    raise exception using errcode = '22023', message = 'Carrier and tracking number must be provided together';
  end if;

  select *
  into v_order
  from public.orders
  where id = v_order_id
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'Order was not found';
  end if;

  select *
  into v_shipment
  from public.shipments
  where order_id = v_order_id
  order by created_at desc
  limit 1
  for update;

  v_carrier := coalesce(v_carrier, v_shipment.carrier);
  v_tracking := coalesce(v_tracking, v_shipment.tracking_number);

  if v_status in ('shipped', 'delivered') then
    if v_order.payment_status <> 'paid' then
      raise exception using errcode = '22023', message = 'Only paid orders can be shipped';
    end if;
    if v_carrier is null or v_tracking is null then
      raise exception using errcode = '22023', message = 'Carrier and tracking number are required before shipping';
    end if;
  end if;

  update public.orders
  set fulfillment_status = v_status,
      order_status = case
        when v_status = 'cancelled' then 'cancelled'
        when v_status = 'delivered' then 'completed'
        when v_status in ('processing', 'shipped') and order_status = 'pending_payment' then 'confirmed'
        else order_status
      end,
      cancelled_at = case when v_status = 'cancelled' then coalesce(cancelled_at, now()) else null end,
      completed_at = case when v_status = 'delivered' then coalesce(completed_at, now()) else null end,
      updated_at = now()
  where id = v_order_id;

  if v_carrier is not null and v_tracking is not null then
    v_shipment_status := case
      when v_status = 'delivered' then 'delivered'
      when v_status = 'shipped' then 'shipped'
      else 'preparing'
    end;

    if v_shipment.id is null then
      insert into public.shipments (
        order_id, carrier, tracking_number, status, shipped_at, delivered_at
      ) values (
        v_order_id,
        v_carrier,
        v_tracking,
        v_shipment_status,
        case when v_status in ('shipped', 'delivered') then now() else null end,
        case when v_status = 'delivered' then now() else null end
      )
      returning id into v_shipment_id;
    else
      update public.shipments
      set carrier = v_carrier,
          tracking_number = v_tracking,
          status = v_shipment_status,
          shipped_at = case
            when v_status in ('shipped', 'delivered') then coalesce(v_shipment.shipped_at, now())
            else null
          end,
          delivered_at = case
            when v_status = 'delivered' then coalesce(v_shipment.delivered_at, now())
            else null
          end,
          updated_at = now()
      where id = v_shipment.id
      returning id into v_shipment_id;
    end if;
  else
    v_shipment_id := v_shipment.id;
  end if;

  insert into public.order_timeline (
    order_id, event_type, from_status, to_status, actor_type, actor_user_id, note, metadata
  ) values (
    v_order_id,
    'fulfillment_status_changed',
    v_order.fulfillment_status,
    v_status,
    'admin',
    auth.uid(),
    v_note,
    jsonb_build_object(
      'carrier', v_carrier,
      'trackingNumber', v_tracking
    )
  );

  insert into public.admin_audit_logs (
    admin_user_id, action, resource_type, resource_id, changed_fields
  ) values (
    auth.uid(),
    'order.fulfillment.update',
    'order',
    v_order_id,
    array['fulfillment_status', 'order_status', 'shipment']::text[]
  );

  return jsonb_build_object(
    'orderId', v_order_id,
    'fulfillmentStatus', v_status,
    'shipmentId', v_shipment_id
  );
end;
$$;

create or replace function public.update_admin_order_fulfillment(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_admin_order_fulfillment(p_payload);
$$;

revoke all on function private.update_admin_order_fulfillment(jsonb) from public, anon, authenticated;
revoke all on function public.update_admin_order_fulfillment(jsonb) from public, anon, authenticated;
grant execute on function public.update_admin_order_fulfillment(jsonb) to authenticated;
