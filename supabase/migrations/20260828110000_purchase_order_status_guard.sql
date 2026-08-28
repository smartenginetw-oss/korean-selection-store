-- V1.5 procurement: keep purchase-order status changes aligned with receiving.

create or replace function private.guard_purchase_order_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  has_receipts boolean;
  total_ordered integer;
  total_accounted integer;
begin
  if new.status = old.status then
    return new;
  end if;

  -- Receiving is the only path allowed to move an ordered PO into an
  -- inventory-backed receiving status. The receipt RPC writes receipt lines
  -- before updating this locked PO row, so validate the aggregate here.
  if old.status in ('ordered', 'partial_received')
    and new.status in ('partial_received', 'received') then
    select coalesce((
      select sum(poi.quantity)
      from public.purchase_order_items poi
      where poi.purchase_order_id = old.id and poi.variant_id is not null
    ), 0)::integer,
    coalesce((
      select sum(ri.quantity_received + ri.damaged_quantity)
      from public.purchase_order_receipt_items ri
      join public.purchase_order_receipts receipt on receipt.id = ri.receipt_id
      join public.purchase_order_items poi on poi.id = ri.purchase_order_item_id
      where receipt.purchase_order_id = old.id and poi.variant_id is not null
    ), 0)::integer
    into total_ordered, total_accounted;
    if total_ordered <= 0 or total_accounted <= 0 then
      raise exception using errcode = '22023', message = 'Receiving status requires receipt quantities';
    end if;
    if new.status = 'received' and total_accounted < total_ordered then
      raise exception using errcode = '22023', message = 'Purchase order is not fully received';
    end if;
    if new.status = 'partial_received' and total_accounted >= total_ordered then
      raise exception using errcode = '22023', message = 'Fully received purchase order must use received status';
    end if;
    return new;
  end if;

  if old.status = 'draft' and new.status in ('ordered', 'cancelled') then
    return new;
  end if;

  if old.status = 'ordered' and new.status = 'cancelled' then
    select exists (
      select 1
      from public.purchase_order_receipts receipt
      where receipt.purchase_order_id = old.id
    ) into has_receipts;
    if has_receipts then
      raise exception using errcode = '22023', message = 'A purchase order with receipts cannot be cancelled';
    end if;
    return new;
  end if;

  raise exception using errcode = '22023', message = 'Invalid purchase order status transition';
end;
$$;

revoke all on function private.guard_purchase_order_status() from public, anon, authenticated;

drop trigger if exists purchase_orders_status_guard on public.purchase_orders;
create trigger purchase_orders_status_guard
before update of status on public.purchase_orders
for each row execute function private.guard_purchase_order_status();

create or replace function public.update_purchase_order_status(
  p_purchase_order_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_order public.purchase_orders%rowtype;
begin
  if not coalesce(private.is_procurement_manager(), false) then
    raise exception using errcode = '42501', message = 'Procurement manager role is required';
  end if;
  if p_purchase_order_id is null or p_status is null then
    raise exception using errcode = '22023', message = 'Purchase order and status are required';
  end if;
  if p_status not in ('draft', 'ordered', 'partial_received', 'received', 'cancelled') then
    raise exception using errcode = '22023', message = 'Purchase order status is invalid';
  end if;

  select * into current_order
  from public.purchase_orders
  where id = p_purchase_order_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Purchase order was not found';
  end if;

  update public.purchase_orders
  set status = p_status,
      updated_at = now()
  where id = p_purchase_order_id;

  return jsonb_build_object(
    'purchaseOrderId', p_purchase_order_id,
    'previousStatus', current_order.status,
    'status', p_status
  );
end;
$$;

revoke all on function public.update_purchase_order_status(uuid, text) from public, anon, authenticated;
grant execute on function public.update_purchase_order_status(uuid, text) to authenticated;
