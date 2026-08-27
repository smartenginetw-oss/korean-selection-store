-- ECPay AIO stage adapter.  The existing test adapter remains the default;
-- this wrapper only creates a pending ECPay payment when the Edge Function
-- explicitly requests the ecpay provider.

create or replace function private.create_ecpay_checkout_order_for_member(
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
  v_payload jsonb;
  v_result jsonb;
  v_order_id uuid;
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_trade_no text;
begin
  if p_profile_id is not null and not exists (
    select 1 from auth.users where id = p_profile_id
  ) then
    raise exception using errcode = '42501', message = 'Member account was not found';
  end if;

  -- Reuse the existing atomic price, coupon and inventory validation.  The
  -- inner call starts as a test payment, then this same transaction changes
  -- only the payment state to pending ECPay. No paid order is observable.
  v_payload := jsonb_set(p_payload, '{paymentProvider}', '"test"'::jsonb, true);
  v_result := private.create_checkout_order_for_member(v_payload, p_idempotency_key, p_profile_id);
  v_order_id := nullif(v_result ->> 'orderId', '')::uuid;

  select * into v_payment
  from public.payments
  where idempotency_key = p_idempotency_key
  for update;

  if not found or v_order_id is null then
    raise exception using errcode = 'P0002', message = 'Checkout payment was not created';
  end if;

  -- Replays of an existing ECPay checkout return the same merchant trade no.
  if v_payment.provider = 'ecpay' then
    select * into v_order from public.orders where id = v_order_id;
    return v_result || jsonb_build_object(
      'paymentProvider', 'ecpay',
      'paymentStatus', v_order.payment_status,
      'merchantTradeNo', v_payment.provider_payment_id,
      'idempotentReplay', true
    );
  end if;

  if v_payment.provider <> 'test' or coalesce((v_result ->> 'idempotentReplay')::boolean, false) then
    raise exception using errcode = '22023', message = 'Idempotency key belongs to another payment provider';
  end if;

  select * into v_order
  from public.orders
  where id = v_order_id
  for update;

  -- ECPay MerchantTradeNo accepts alphanumeric values only.  The storefront
  -- order number contains one hyphen, so remove it and add an E prefix.
  v_trade_no := 'E' || replace(v_order.order_number, '-', '');

  update public.payments
  set provider = 'ecpay',
      provider_payment_id = v_trade_no,
      status = 'pending',
      paid_at = null,
      failure_code = null,
      failure_message = null,
      failed_at = null,
      updated_at = now()
  where id = v_payment.id;

  update public.orders
  set payment_status = 'pending',
      order_status = 'pending_payment',
      updated_at = now()
  where id = v_order_id;

  update public.order_timeline
  set note = 'ECPay 測試付款待完成。',
      metadata = metadata || jsonb_build_object('provider', 'ecpay')
  where order_id = v_order_id
    and event_type = 'checkout_created'
    and metadata ->> 'provider' = 'test';

  insert into public.order_timeline (
    order_id, event_type, to_status, actor_type, note, metadata
  ) values (
    v_order_id, 'payment_pending', 'pending_payment', 'system',
    'ECPay 測試付款頁已準備，等待付款結果通知。',
    jsonb_build_object('provider', 'ecpay', 'merchantTradeNo', v_trade_no)
  );

  return v_result || jsonb_build_object(
    'paymentProvider', 'ecpay',
    'paymentStatus', 'pending',
    'merchantTradeNo', v_trade_no,
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.create_ecpay_checkout_order_for_member(
  p_payload jsonb,
  p_idempotency_key text,
  p_profile_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_ecpay_checkout_order_for_member(p_payload, p_idempotency_key, p_profile_id);
$$;

revoke all on function private.create_ecpay_checkout_order_for_member(jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.create_ecpay_checkout_order_for_member(jsonb, text, uuid) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.create_ecpay_checkout_order_for_member(jsonb, text, uuid) to service_role;
grant execute on function public.create_ecpay_checkout_order_for_member(jsonb, text, uuid) to service_role;

-- Callback state transition.  CheckMacValue is verified by the callback Edge
-- Function before this RPC is called. This function remains service-role-only
-- and is idempotent on the ECPay trade/result pair.
create or replace function private.record_ecpay_payment_callback(
  p_merchant_trade_no text,
  p_trade_no text,
  p_rtn_code text,
  p_rtn_msg text,
  p_trade_amt integer,
  p_payment_date text,
  p_payment_type text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_order public.orders%rowtype;
  v_event_id text;
  v_success boolean := coalesce(trim(p_rtn_code), '') = '1';
  v_expired boolean := false;
  v_reservation record;
  v_inventory public.inventory_levels%rowtype;
begin
  if p_merchant_trade_no is null or p_merchant_trade_no !~ '^[A-Za-z0-9]{1,20}$' then
    raise exception using errcode = '22023', message = 'Merchant trade number is invalid';
  end if;
  if p_trade_amt is null or p_trade_amt < 0 then
    raise exception using errcode = '22023', message = 'Trade amount is invalid';
  end if;

  select p.* into v_payment
  from public.payments p
  where p.provider = 'ecpay'
    and p.provider_payment_id = p_merchant_trade_no
  for update;

  if not found then
    raise exception using errcode = 'P0002', message = 'ECPay payment was not found';
  end if;

  if p_trade_amt <> v_payment.amount then
    raise exception using errcode = 'P0001', message = 'ECPay amount does not match the order';
  end if;

  select * into v_order from public.orders where id = v_payment.order_id for update;
  v_event_id := 'ecpay:' || p_merchant_trade_no || ':' || coalesce(nullif(trim(p_trade_no), ''), 'rtn-' || coalesce(trim(p_rtn_code), 'unknown'));

  if exists (select 1 from public.payment_events where provider_event_id = v_event_id) then
    return jsonb_build_object(
      'processed', true,
      'duplicate', true,
      'paymentStatus', v_order.payment_status,
      'orderStatus', v_order.order_status
    );
  end if;

  insert into public.payment_events (
    payment_id, provider_event_id, event_type, payload, signature_valid,
    processing_status, processed_at
  ) values (
    v_payment.id, v_event_id, 'ecpay_payment_result',
    jsonb_build_object(
      'merchantTradeNo', p_merchant_trade_no,
      'tradeNo', nullif(trim(p_trade_no), ''),
      'rtnCode', trim(coalesce(p_rtn_code, '')),
      'tradeAmt', p_trade_amt,
      'paymentDate', nullif(trim(p_payment_date), ''),
      'paymentType', nullif(trim(p_payment_type), '')
    ),
    true, 'processed', now()
  );

  if v_success and v_payment.status = 'pending' then
    v_expired := not exists (
      select 1 from public.inventory_reservations
      where order_id = v_order.id and status = 'active'
    ) or exists (
      select 1 from public.inventory_reservations
      where order_id = v_order.id and status = 'active' and expires_at <= now()
    );

    update public.payments
    set status = 'paid',
        paid_at = case when p_payment_date ~ '^[0-9]{4}/[0-9]{2}/[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}$'
          then to_timestamp(p_payment_date, 'YYYY/MM/DD HH24:MI:SS') else now() end,
        failure_code = null, failure_message = null, failed_at = null, updated_at = now()
    where id = v_payment.id;

    update public.orders
    set payment_status = 'paid',
        order_status = case when v_expired then 'exception' else 'confirmed' end,
        updated_at = now()
    where id = v_order.id;

    insert into public.order_timeline (
      order_id, event_type, from_status, to_status, actor_type, note, metadata
    ) values (
      v_order.id,
      case when v_expired then 'payment_succeeded_inventory_exception' else 'payment_succeeded' end,
      v_order.order_status,
      case when v_expired then 'exception' else 'confirmed' end,
      'system',
      case when v_expired
        then 'ECPay 已付款，但庫存保留已過期，請人工處理。'
        else 'ECPay 測試付款已確認。'
      end,
      jsonb_build_object('provider', 'ecpay', 'tradeNo', nullif(trim(p_trade_no), ''), 'inventoryException', v_expired)
    );
  elsif not v_success and v_payment.status = 'pending' then
    update public.payments
    set status = 'failed', failed_at = now(),
        failure_code = nullif(trim(p_rtn_code), ''),
        failure_message = left(nullif(trim(p_rtn_msg), ''), 500),
        updated_at = now()
    where id = v_payment.id;

    for v_reservation in
      select * from public.inventory_reservations
      where order_id = v_order.id and status = 'active'
      order by id
      for update
    loop
      select * into v_inventory from public.inventory_levels
      where variant_id = v_reservation.variant_id for update;
      if found and v_inventory.reserved >= v_reservation.quantity then
        update public.inventory_levels
        set reserved = reserved - v_reservation.quantity, updated_at = now()
        where variant_id = v_reservation.variant_id;
        update public.inventory_reservations
        set status = case when expires_at <= now() then 'expired' else 'released' end,
            released_at = now()
        where id = v_reservation.id;
      end if;
    end loop;

    if v_order.coupon_id is not null then
      update public.coupons
      set usage_count = greatest(0, usage_count - 1), updated_at = now()
      where id = v_order.coupon_id;
    end if;

    update public.orders
    set payment_status = 'failed', fulfillment_status = 'cancelled',
        order_status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
    where id = v_order.id;

    insert into public.order_timeline (
      order_id, event_type, from_status, to_status, actor_type, note, metadata
    ) values (
      v_order.id, 'payment_failed', v_order.order_status, 'cancelled', 'system',
      'ECPay 測試付款未完成，訂單已取消並釋放庫存。',
      jsonb_build_object('provider', 'ecpay', 'rtnCode', trim(coalesce(p_rtn_code, '')), 'rtnMsg', left(coalesce(p_rtn_msg, ''), 200))
    );
  end if;

  select payment_status, order_status into v_order.payment_status, v_order.order_status
  from public.orders where id = v_order.id;
  return jsonb_build_object(
    'processed', true,
    'duplicate', false,
    'paymentStatus', v_order.payment_status,
    'orderStatus', v_order.order_status
  );
end;
$$;

create or replace function public.record_ecpay_payment_callback(
  p_merchant_trade_no text,
  p_trade_no text,
  p_rtn_code text,
  p_rtn_msg text,
  p_trade_amt integer,
  p_payment_date text,
  p_payment_type text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_ecpay_payment_callback(
    p_merchant_trade_no, p_trade_no, p_rtn_code, p_rtn_msg,
    p_trade_amt, p_payment_date, p_payment_type
  );
$$;

revoke all on function private.record_ecpay_payment_callback(text, text, text, text, integer, text, text) from public, anon, authenticated;
revoke all on function public.record_ecpay_payment_callback(text, text, text, text, integer, text, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.record_ecpay_payment_callback(text, text, text, text, integer, text, text) to service_role;
grant execute on function public.record_ecpay_payment_callback(text, text, text, text, integer, text, text) to service_role;
