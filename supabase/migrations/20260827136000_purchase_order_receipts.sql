-- V1.5 purchase receiving: immutable receipt batches with atomic inventory posting.

create table if not exists public.purchase_order_receipts (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete restrict,
  receipt_number text not null check (char_length(receipt_number) between 1 and 80),
  received_date date not null default current_date,
  note text check (note is null or char_length(note) <= 2000),
  created_by uuid not null default auth.uid() references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create unique index if not exists purchase_order_receipts_number_lower_uq on public.purchase_order_receipts(lower(receipt_number));
create index if not exists purchase_order_receipts_order_date_idx on public.purchase_order_receipts(purchase_order_id, received_date desc);

create table if not exists public.purchase_order_receipt_items (
  id uuid primary key default gen_random_uuid(),
  receipt_id uuid not null references public.purchase_order_receipts(id) on delete restrict,
  purchase_order_item_id uuid not null references public.purchase_order_items(id) on delete restrict,
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  product_name text not null check (char_length(product_name) between 1 and 160),
  sku text,
  quantity_received integer not null check (quantity_received > 0),
  created_at timestamptz not null default now(),
  constraint purchase_order_receipt_items_unique_item unique (receipt_id, purchase_order_item_id)
);

create index if not exists purchase_order_receipt_items_receipt_idx on public.purchase_order_receipt_items(receipt_id);
create index if not exists purchase_order_receipt_items_order_item_idx on public.purchase_order_receipt_items(purchase_order_item_id);

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
  v_received_before integer;
  v_balance_after integer;
  v_total_ordered integer;
  v_total_received integer;
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
    v_quantity := nullif(v_item->>'quantity', '')::integer;
    if v_purchase_order_item_id is null or v_quantity is null or v_quantity <= 0 then
      raise exception using errcode = '22023', message = 'Receipt quantity is invalid';
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

    select coalesce(sum(ri.quantity_received), 0)::integer into v_received_before
    from public.purchase_order_receipt_items ri
    join public.purchase_order_receipts r on r.id = ri.receipt_id
    where r.purchase_order_id = p_purchase_order_id
      and ri.purchase_order_item_id = v_purchase_order_item_id;
    if v_quantity > v_purchase_order_item.quantity - v_received_before then
      raise exception using errcode = '22023', message = 'Receipt quantity exceeds remaining purchase quantity';
    end if;

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

    insert into public.purchase_order_receipt_items (
      receipt_id, purchase_order_item_id, variant_id, product_name, sku, quantity_received
    ) values (
      v_receipt_id,
      v_purchase_order_item_id,
      v_purchase_order_item.variant_id,
      v_purchase_order_item.product_name,
      v_purchase_order_item.sku,
      v_quantity
    );
    v_item_count := v_item_count + 1;
  end loop;

  if v_item_count = 0 then
    raise exception using errcode = '22023', message = 'At least one receipt item is required';
  end if;

  select coalesce(sum(poi.quantity), 0)::integer into v_total_ordered
  from public.purchase_order_items poi
  where poi.purchase_order_id = p_purchase_order_id and poi.variant_id is not null;
  select coalesce(sum(ri.quantity_received), 0)::integer into v_total_received
  from public.purchase_order_receipt_items ri
  join public.purchase_order_receipts r on r.id = ri.receipt_id
  join public.purchase_order_items poi on poi.id = ri.purchase_order_item_id
  where r.purchase_order_id = p_purchase_order_id and poi.variant_id is not null;

  update public.purchase_orders
  set status = case when v_total_received >= v_total_ordered and v_total_ordered > 0 then 'received' else 'partial_received' end,
      updated_at = now()
  where id = p_purchase_order_id;

  return jsonb_build_object(
    'receiptId', v_receipt_id,
    'purchaseOrderId', p_purchase_order_id,
    'status', case when v_total_received >= v_total_ordered and v_total_ordered > 0 then 'received' else 'partial_received' end,
    'receivedQuantity', v_total_received,
    'orderedQuantity', v_total_ordered
  );
end;
$$;

revoke all on function public.receive_purchase_order(uuid, text, date, text, jsonb) from public, anon, authenticated;

alter table public.purchase_order_receipts enable row level security;
alter table public.purchase_order_receipt_items enable row level security;

drop policy if exists purchase_order_receipts_backoffice_select on public.purchase_order_receipts;
create policy purchase_order_receipts_backoffice_select on public.purchase_order_receipts
  for select to authenticated using (private.is_procurement_manager());

drop policy if exists purchase_order_receipt_items_backoffice_select on public.purchase_order_receipt_items;
create policy purchase_order_receipt_items_backoffice_select on public.purchase_order_receipt_items
  for select to authenticated using (private.is_procurement_manager());
