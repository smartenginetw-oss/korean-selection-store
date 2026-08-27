-- Persist the selected ECPay method and the ATM/CVS payment instructions that
-- ECPay sends through PaymentInfoURL.  The values are intentionally limited to
-- operational identifiers; card data is never accepted or stored here.

alter table public.payments
  add column if not exists payment_method text not null default 'test';

alter table public.payments
  add column if not exists payment_info jsonb not null default '{}'::jsonb;

alter table public.payments
  drop constraint if exists payments_payment_method_check;

alter table public.payments
  add constraint payments_payment_method_check
  check (payment_method in ('test', 'credit', 'atm', 'cvs'));

alter table public.payments
  drop constraint if exists payments_payment_info_object_check;

alter table public.payments
  add constraint payments_payment_info_object_check
  check (jsonb_typeof(payment_info) = 'object');

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
  v_payment_method text;
begin
  if p_profile_id is not null and not exists (
    select 1 from auth.users where id = p_profile_id
  ) then
    raise exception using errcode = '42501', message = 'Member account was not found';
  end if;

  v_payment_method := lower(coalesce(nullif(trim(p_payload ->> 'paymentMethod'), ''), 'credit'));
  if v_payment_method not in ('credit', 'atm', 'cvs') then
    raise exception using errcode = '22023', message = 'ECPay payment method is invalid';
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
      'paymentMethod', v_payment.payment_method,
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
      payment_method = v_payment_method,
      payment_info = '{}'::jsonb,
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
      metadata = metadata || jsonb_build_object('provider', 'ecpay', 'paymentMethod', v_payment_method)
  where order_id = v_order_id
    and event_type = 'checkout_created'
    and metadata ->> 'provider' = 'test';

  insert into public.order_timeline (
    order_id, event_type, to_status, actor_type, note, metadata
  ) values (
    v_order_id, 'payment_pending', 'pending_payment', 'system',
    'ECPay 測試付款頁已準備，等待付款結果通知。',
    jsonb_build_object('provider', 'ecpay', 'paymentMethod', v_payment_method, 'merchantTradeNo', v_trade_no)
  );

  return v_result || jsonb_build_object(
    'paymentProvider', 'ecpay',
    'paymentMethod', v_payment_method,
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

-- ECPay ATM/CVS payment information callback.  This function is only callable
-- by the callback Edge Function using service_role and is idempotent on the
-- provider event id.
create or replace function private.record_ecpay_payment_info(
  p_merchant_trade_no text,
  p_trade_no text,
  p_rtn_code text,
  p_rtn_msg text,
  p_trade_amt integer,
  p_payment_type text,
  p_payment_no text,
  p_bank_code text,
  p_vaccount text,
  p_expire_date text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_payment public.payments%rowtype;
  v_event_id text;
  v_inserted integer;
  v_success boolean := coalesce(trim(p_rtn_code), '') = '1';
  v_info jsonb;
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

  v_event_id := 'ecpay-info:' || p_merchant_trade_no || ':' || coalesce(
    nullif(trim(p_trade_no), ''),
    nullif(trim(p_payment_no), ''),
    nullif(trim(p_bank_code) || ':' || trim(p_vaccount), ':'),
    'rtn-' || coalesce(trim(p_rtn_code), 'unknown') || ':' || coalesce(trim(p_expire_date), '')
  );

  insert into public.payment_events (
    payment_id, provider_event_id, event_type, payload, signature_valid,
    processing_status, processed_at
  ) values (
    v_payment.id, v_event_id, 'ecpay_payment_info',
    jsonb_strip_nulls(jsonb_build_object(
      'merchantTradeNo', p_merchant_trade_no,
      'tradeNo', nullif(left(trim(coalesce(p_trade_no, '')), 120), ''),
      'rtnCode', left(trim(coalesce(p_rtn_code, '')), 40),
      'rtnMsg', nullif(left(trim(coalesce(p_rtn_msg, '')), 200), ''),
      'tradeAmt', p_trade_amt,
      'paymentType', nullif(left(trim(coalesce(p_payment_type, '')), 40), ''),
      'paymentNo', nullif(left(trim(coalesce(p_payment_no, '')), 120), ''),
      'bankCode', nullif(left(trim(coalesce(p_bank_code, '')), 40), ''),
      'vAccount', nullif(left(trim(coalesce(p_vaccount, '')), 120), ''),
      'expireDate', nullif(left(trim(coalesce(p_expire_date, '')), 40), '')
    )),
    true, 'processed', now()
  ) on conflict (provider_event_id) do nothing;
  get diagnostics v_inserted = row_count;

  if v_inserted = 0 then
    return jsonb_build_object('processed', true, 'duplicate', true);
  end if;

  if v_success and v_payment.payment_method in ('atm', 'cvs') then
    v_info := jsonb_strip_nulls(jsonb_build_object(
      'paymentType', nullif(left(trim(coalesce(p_payment_type, '')), 40), ''),
      'paymentNo', nullif(left(trim(coalesce(p_payment_no, '')), 120), ''),
      'bankCode', nullif(left(trim(coalesce(p_bank_code, '')), 40), ''),
      'vAccount', nullif(left(trim(coalesce(p_vaccount, '')), 120), ''),
      'expireDate', nullif(left(trim(coalesce(p_expire_date, '')), 40), ''),
      'tradeNo', nullif(left(trim(coalesce(p_trade_no, '')), 120), '')
    ));
    update public.payments
    set payment_info = v_info, updated_at = now()
    where id = v_payment.id;
  end if;

  return jsonb_build_object('processed', true, 'duplicate', false);
end;
$$;

create or replace function public.record_ecpay_payment_info(
  p_merchant_trade_no text,
  p_trade_no text,
  p_rtn_code text,
  p_rtn_msg text,
  p_trade_amt integer,
  p_payment_type text,
  p_payment_no text,
  p_bank_code text,
  p_vaccount text,
  p_expire_date text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.record_ecpay_payment_info(
    p_merchant_trade_no, p_trade_no, p_rtn_code, p_rtn_msg, p_trade_amt,
    p_payment_type, p_payment_no, p_bank_code, p_vaccount, p_expire_date
  );
$$;

revoke all on function private.record_ecpay_payment_info(text, text, text, text, integer, text, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_ecpay_payment_info(text, text, text, text, integer, text, text, text, text, text) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.record_ecpay_payment_info(text, text, text, text, integer, text, text, text, text, text) to service_role;
grant execute on function public.record_ecpay_payment_info(text, text, text, text, integer, text, text, text, text, text) to service_role;
