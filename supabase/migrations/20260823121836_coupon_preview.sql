-- Server-only coupon preview. It reads current product prices and coupon rules
-- but never increments usage_count or reserves inventory. Final checkout still
-- revalidates and applies the discount in its own transaction.

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

    select pv.id, coalesce(pv.price_override, p.sale_price) as unit_price
    into variant_row
    from public.product_variants pv
    join public.products p on p.id = pv.product_id
    where pv.id = item."variantId" and pv.status = 'active'
      and pv.fulfillment_mode in ('in_stock', 'preorder') and p.status = 'active';

    if not found then
      raise exception using errcode = 'P0001', message = 'Product variant is no longer available';
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

create or replace function public.preview_coupon_discount(p_payload jsonb)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.preview_coupon_discount(p_payload);
$$;

revoke all on function private.preview_coupon_discount(jsonb) from public, anon, authenticated;
revoke all on function public.preview_coupon_discount(jsonb) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.preview_coupon_discount(jsonb) to service_role;
grant execute on function public.preview_coupon_discount(jsonb) to service_role;
