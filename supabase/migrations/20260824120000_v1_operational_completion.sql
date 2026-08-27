-- V1 operational completion: product details, product lifecycle and test-adapter refunds.
-- All mutations remain behind capability checks and produce an audit/timeline record.

create or replace function private.update_admin_product_details(p_product_id uuid, p_payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_material text := nullif(trim(coalesce(p_payload->>'material', '')), '');
  v_size_guide text := nullif(trim(coalesce(p_payload->>'sizeGuide', '')), '');
  v_model_info text := nullif(trim(coalesce(p_payload->>'modelInfo', '')), '');
  v_origin text := nullif(trim(coalesce(p_payload->>'origin', '')), '');
  v_care_instructions text := nullif(trim(coalesce(p_payload->>'careInstructions', '')), '');
begin
  if not coalesce(private.can_manage_catalog(), false) then
    raise exception using errcode = '42501', message = 'Catalog role is required';
  end if;
  if p_product_id is null or not exists (select 1 from public.products where id = p_product_id) then
    raise exception using errcode = 'P0002', message = 'Product was not found';
  end if;
  if coalesce(length(v_material), 0) > 2000
    or coalesce(length(v_size_guide), 0) > 4000
    or coalesce(length(v_model_info), 0) > 1000
    or coalesce(length(v_origin), 0) > 200
    or coalesce(length(v_care_instructions), 0) > 2000 then
    raise exception using errcode = '22023', message = 'Product detail text is too long';
  end if;

  update public.products
  set material = v_material,
      size_guide = v_size_guide,
      model_info = v_model_info,
      origin = v_origin,
      care_instructions = v_care_instructions,
      updated_at = now()
  where id = p_product_id;

  insert into public.admin_audit_logs (admin_user_id, action, resource_type, resource_id, changed_fields)
  values (auth.uid(), 'product.details.update', 'product', p_product_id,
    array['material', 'size_guide', 'model_info', 'origin', 'care_instructions']::text[]);

  return jsonb_build_object('productId', p_product_id);
end;
$$;

create or replace function public.update_admin_product_details(p_product_id uuid, p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_admin_product_details(p_product_id, p_payload);
$$;

create or replace function private.set_admin_product_status(p_product_id uuid, p_status text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_status text := lower(trim(coalesce(p_status, '')));
  v_slug text;
begin
  if not coalesce(private.can_manage_catalog(), false) then
    raise exception using errcode = '42501', message = 'Catalog role is required';
  end if;
  if v_status not in ('draft', 'active', 'archived') then
    raise exception using errcode = '22023', message = 'Product status is invalid';
  end if;

  update public.products
  set status = v_status,
      published_at = case when v_status = 'active' then coalesce(published_at, now()) else null end,
      archived_at = case when v_status = 'archived' then coalesce(archived_at, now()) else null end,
      updated_at = now()
  where id = p_product_id
  returning slug into v_slug;

  if v_slug is null then
    raise exception using errcode = 'P0002', message = 'Product was not found';
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, resource_type, resource_id, changed_fields)
  values (auth.uid(), 'product.status.update', 'product', p_product_id, array['status']::text[]);

  return jsonb_build_object('productId', p_product_id, 'slug', v_slug, 'status', v_status);
end;
$$;

create or replace function public.set_admin_product_status(p_product_id uuid, p_status text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_admin_product_status(p_product_id, p_status);
$$;

create or replace function private.refund_admin_order(p_order_id uuid, p_refund_amount integer, p_reason text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_order public.orders%rowtype;
  v_payment public.payments%rowtype;
  v_amount integer := p_refund_amount;
  v_refundable integer;
  v_new_refunded integer;
  v_new_status text;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not coalesce(private.can_manage_orders(), false) then
    raise exception using errcode = '42501', message = 'Order role is required';
  end if;
  if p_order_id is null then
    raise exception using errcode = '22023', message = 'Order id is required';
  end if;

  select * into v_order from public.orders where id = p_order_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Order was not found';
  end if;

  select * into v_payment
  from public.payments
  where order_id = p_order_id
  order by created_at desc
  limit 1
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Payment was not found';
  end if;
  if v_payment.provider <> 'test' then
    raise exception using errcode = '0A000', message = 'Real payment provider refund is not configured';
  end if;
  if v_payment.status not in ('paid', 'partially_refunded') then
    raise exception using errcode = '22023', message = 'Only paid payments can be refunded';
  end if;

  v_refundable := v_payment.amount - v_payment.refunded_amount;
  v_amount := coalesce(v_amount, v_refundable);
  if v_amount <= 0 or v_amount > v_refundable then
    raise exception using errcode = '22023', message = 'Refund amount exceeds the refundable balance';
  end if;
  v_new_refunded := v_payment.refunded_amount + v_amount;
  v_new_status := case when v_new_refunded = v_payment.amount then 'refunded' else 'partially_refunded' end;

  update public.payments
  set refunded_amount = v_new_refunded,
      status = v_new_status,
      updated_at = now()
  where id = v_payment.id;

  update public.orders
  set payment_status = v_new_status,
      updated_at = now()
  where id = p_order_id;

  insert into public.order_timeline (order_id, event_type, from_status, to_status, actor_type, actor_user_id, note, metadata)
  values (
    p_order_id,
    'payment_refunded',
    v_order.payment_status,
    v_new_status,
    'admin',
    auth.uid(),
    v_reason,
    jsonb_build_object('amount', v_amount, 'refundedAmount', v_new_refunded, 'provider', v_payment.provider)
  );

  insert into public.admin_audit_logs (admin_user_id, action, resource_type, resource_id, changed_fields)
  values (auth.uid(), 'order.payment.refund', 'order', p_order_id,
    array['payment_status', 'refunded_amount']::text[]);

  return jsonb_build_object(
    'orderId', p_order_id,
    'paymentStatus', v_new_status,
    'refundedAmount', v_new_refunded,
    'refundAmount', v_amount
  );
end;
$$;

create or replace function public.refund_admin_order(p_order_id uuid, p_refund_amount integer, p_reason text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.refund_admin_order(p_order_id, p_refund_amount, p_reason);
$$;

revoke all on function public.update_admin_product_details(uuid, jsonb) from public, anon;
revoke all on function public.set_admin_product_status(uuid, text) from public, anon;
revoke all on function public.refund_admin_order(uuid, integer, text) from public, anon;
grant execute on function public.update_admin_product_details(uuid, jsonb) to authenticated;
grant execute on function public.set_admin_product_status(uuid, text) to authenticated;
grant execute on function public.refund_admin_order(uuid, integer, text) to authenticated;
