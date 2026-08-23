-- Admin inventory adjustment transaction.
-- Manual changes are audited and cannot reduce on-hand below active holds.

create or replace function private.adjust_admin_inventory(
  p_variant_id uuid,
  p_on_hand integer,
  p_low_stock_threshold integer,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inventory public.inventory_levels%rowtype;
  v_delta integer;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not coalesce(private.is_admin(), false) then
    raise exception using errcode = '42501', message = 'Admin role is required';
  end if;
  if p_variant_id is null or p_on_hand is null or p_on_hand < 0 then
    raise exception using errcode = '22023', message = 'A non-negative stock quantity is required';
  end if;
  if p_low_stock_threshold is null or p_low_stock_threshold < 0 or p_low_stock_threshold > 100000 then
    raise exception using errcode = '22023', message = 'Low-stock threshold is invalid';
  end if;
  if v_reason is null or length(v_reason) > 240 then
    raise exception using errcode = '22023', message = 'A reason is required for inventory adjustment';
  end if;

  select * into v_inventory
  from public.inventory_levels
  where variant_id = p_variant_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Inventory level was not found';
  end if;
  if p_on_hand < v_inventory.reserved then
    raise exception using errcode = '22023', message = 'On-hand stock cannot be lower than reserved stock';
  end if;

  v_delta := p_on_hand - v_inventory.on_hand;
  update public.inventory_levels
  set on_hand = p_on_hand,
      low_stock_threshold = p_low_stock_threshold,
      updated_at = now()
  where variant_id = p_variant_id;

  if v_delta <> 0 then
    insert into public.inventory_movements (
      variant_id, admin_user_id, type, quantity_delta, balance_after, reason, idempotency_key
    ) values (
      p_variant_id,
      auth.uid(),
      'manual_adjustment',
      v_delta,
      p_on_hand,
      v_reason,
      'manual-adjustment:' || p_variant_id::text || ':' || gen_random_uuid()::text
    );
  end if;

  insert into public.admin_audit_logs (
    admin_user_id, action, resource_type, resource_id, changed_fields
  ) values (
    auth.uid(),
    'inventory.adjust',
    'variant',
    p_variant_id,
    array['on_hand', 'low_stock_threshold', 'reason']::text[]
  );

  return jsonb_build_object(
    'variantId', p_variant_id,
    'onHand', p_on_hand,
    'reserved', v_inventory.reserved,
    'lowStockThreshold', p_low_stock_threshold,
    'delta', v_delta
  );
end;
$$;

create or replace function public.adjust_admin_inventory(
  p_variant_id uuid,
  p_on_hand integer,
  p_low_stock_threshold integer,
  p_reason text
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.adjust_admin_inventory(p_variant_id, p_on_hand, p_low_stock_threshold, p_reason);
$$;

revoke all on function private.adjust_admin_inventory(uuid, integer, integer, text) from public, anon, authenticated;
revoke all on function public.adjust_admin_inventory(uuid, integer, integer, text) from public, anon, authenticated;
grant execute on function public.adjust_admin_inventory(uuid, integer, integer, text) to authenticated;
