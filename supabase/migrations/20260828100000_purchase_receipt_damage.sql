-- V1.5 purchase receiving: track damaged units separately from stockable units.

alter table public.purchase_order_receipt_items
  add column if not exists damaged_quantity integer not null default 0;

-- A receipt line may contain only damaged units, so the good-unit check from
-- the original table must allow zero while the combined quantity stays > 0.
alter table public.purchase_order_receipt_items
  drop constraint if exists purchase_order_receipt_items_quantity_received_check;
alter table public.purchase_order_receipt_items
  drop constraint if exists purchase_order_receipt_items_total_quantity_check;
alter table public.purchase_order_receipt_items
  add constraint purchase_order_receipt_items_quantity_received_check check (quantity_received >= 0),
  add constraint purchase_order_receipt_items_damaged_quantity_check check (damaged_quantity >= 0),
  add constraint purchase_order_receipt_items_total_quantity_check check (quantity_received + damaged_quantity > 0);

create or replace function public.receive_purchase_order(
  p_purchase_order_id uuid,
  p_receipt_number text,
  p_received_date date,
  p_note text,
  p_items jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_purchase_order public.purchase_orders%rowtype;
  v_receipt_id uuid;
  v_item jsonb;
  v_purchase_order_item public.purchase_order_items%rowtype;
  v_inventory public.inventory_levels%rowtype;
  v_purchase_order_item_id uuid;
  v_quantity integer;
  v_damaged_quantity integer;
  v_received_before integer;
  v_balance_after integer;
  v_total_ordered integer;
  v_total_good_received integer;
  v_total_damaged_received integer;
  v_total_accounted integer;
  v_item_count integer := 0;
begin
  if not coalesce(private.is_procurement_manager(), false) then
    raise exception using errcode = '42501', message = 'Procurement manager role is required';
  end if;
  if p_purchase_order_id is null then
    raise exception using errcode = '22023', message = 'Purchase order is required';
  end if;
  if p_receipt_number is null or char_length(trim(p_receipt_number)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Receipt number is required';
  end if;
  if p_received_date is null then
    raise exception using errcode = '22023', message = 'Receipt date is required';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' then
    raise exception using errcode = '22023', message = 'Receipt items are required';
  end if;

  select * into v_purchase_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Purchase order was not found';
  end if;
  if v_purchase_order.status not in ('ordered', 'partial_received') then
    raise exception using errcode = '22023', message = 'Purchase order must be marked ordered before receiving';
  end if;

  insert into public.purchase_order_receipts (purchase_order_id, receipt_number, received_date, note, created_by)
  values (p_purchase_order_id, trim(p_receipt_number), p_received_date, nullif(trim(coalesce(p_note, '')), ''), auth.uid())
  returning id into v_receipt_id;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_purchase_order_item_id := nullif(v_item->>'purchaseOrderItemId', '')::uuid;
    v_quantity := coalesce(nullif(v_item->>'quantity', '')::integer, 0);
    v_damaged_quantity := coalesce(nullif(v_item->>'damagedQuantity', '')::integer, 0);
    if v_purchase_order_item_id is null or v_quantity < 0 or v_damaged_quantity < 0 or (v_quantity + v_damaged_quantity) <= 0 then
      raise exception using errcode = '22023', message = 'Receipt good or damaged quantity is invalid';
    end if;

    select * into v_purchase_order_item
    from public.purchase_order_items
    where id = v_purchase_order_item_id and purchase_order_id = p_purchase_order_id
    for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Purchase order item was not found';
    end if;
    if v_purchase_order_item.variant_id is null then
      raise exception using errcode = '22023', message = 'Temporary products cannot be posted to inventory';
    end if;

    select coalesce(sum(ri.quantity_received + ri.damaged_quantity), 0)::integer into v_received_before
    from public.purchase_order_receipt_items ri
    join public.purchase_order_receipts r on r.id = ri.receipt_id
    where r.purchase_order_id = p_purchase_order_id
      and ri.purchase_order_item_id = v_purchase_order_item_id;
    if (v_quantity + v_damaged_quantity) > v_purchase_order_item.quantity - v_received_before then
      raise exception using errcode = '22023', message = 'Receipt quantity exceeds remaining purchase quantity';
    end if;

    -- Damaged units are recorded for reconciliation but never enter sellable stock.
    if v_quantity > 0 then
      insert into public.inventory_levels (variant_id, on_hand, reserved)
      values (v_purchase_order_item.variant_id, 0, 0)
      on conflict (variant_id) do nothing;
      select * into v_inventory from public.inventory_levels where variant_id = v_purchase_order_item.variant_id for update;
      v_balance_after := v_inventory.on_hand + v_quantity;
      update public.inventory_levels
      set on_hand = v_balance_after, updated_at = now()
      where variant_id = v_purchase_order_item.variant_id;

      insert into public.inventory_movements (
        variant_id, admin_user_id, type, quantity_delta, balance_after, reason, idempotency_key
      ) values (
        v_purchase_order_item.variant_id,
        auth.uid(),
        'purchase_received',
        v_quantity,
        v_balance_after,
        '採購到貨：' || trim(p_receipt_number),
        'purchase-receipt:' || v_receipt_id::text || ':' || v_purchase_order_item_id::text
      );
    end if;

    insert into public.purchase_order_receipt_items (
      receipt_id, purchase_order_item_id, variant_id, product_name, sku, quantity_received, damaged_quantity
    ) values (
      v_receipt_id,
      v_purchase_order_item_id,
      v_purchase_order_item.variant_id,
      v_purchase_order_item.product_name,
      v_purchase_order_item.sku,
      v_quantity,
      v_damaged_quantity
    );
    v_item_count := v_item_count + 1;
  end loop;

  if v_item_count = 0 then
    raise exception using errcode = '22023', message = 'At least one receipt item is required';
  end if;

  select coalesce(sum(poi.quantity), 0)::integer into v_total_ordered
  from public.purchase_order_items poi
  where poi.purchase_order_id = p_purchase_order_id and poi.variant_id is not null;
  select coalesce(sum(ri.quantity_received), 0)::integer,
         coalesce(sum(ri.damaged_quantity), 0)::integer
    into v_total_good_received, v_total_damaged_received
  from public.purchase_order_receipt_items ri
  join public.purchase_order_receipts r on r.id = ri.receipt_id
  join public.purchase_order_items poi on poi.id = ri.purchase_order_item_id
  where r.purchase_order_id = p_purchase_order_id and poi.variant_id is not null;
  v_total_accounted := v_total_good_received + v_total_damaged_received;

  update public.purchase_orders
  set status = case when v_total_accounted >= v_total_ordered and v_total_ordered > 0 then 'received' else 'partial_received' end,
      updated_at = now()
  where id = p_purchase_order_id;

  return jsonb_build_object(
    'receiptId', v_receipt_id,
    'purchaseOrderId', p_purchase_order_id,
    'status', case when v_total_accounted >= v_total_ordered and v_total_ordered > 0 then 'received' else 'partial_received' end,
    'receivedQuantity', v_total_good_received,
    'damagedQuantity', v_total_damaged_received,
    'accountedQuantity', v_total_accounted,
    'orderedQuantity', v_total_ordered
  );
end;
$$;

revoke all on function public.receive_purchase_order(uuid, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.receive_purchase_order(uuid, text, date, text, jsonb) to authenticated;
