-- V1.5 procurement: keep supplier quotation status changes in a reviewable order.

create or replace function private.guard_supplier_quotation_status()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = old.status then
    return new;
  end if;

  if old.status = 'draft' and new.status in ('received', 'rejected') then
    return new;
  end if;

  if old.status = 'received' and new.status in ('approved', 'rejected') then
    return new;
  end if;

  -- Only the quotation-to-purchase-order action may mark an approved quote
  -- as converted. The action creates the PO first, then calls this RPC.
  if old.status = 'approved' and new.status = 'converted' then
    return new;
  end if;

  raise exception using errcode = '22023', message = 'Invalid supplier quotation status transition';
end;
$$;

revoke all on function private.guard_supplier_quotation_status() from public, anon, authenticated;

drop trigger if exists supplier_quotations_status_guard on public.supplier_quotations;
create trigger supplier_quotations_status_guard
before update of status on public.supplier_quotations
for each row execute function private.guard_supplier_quotation_status();

create or replace function public.update_supplier_quotation_status(
  p_quotation_id uuid,
  p_status text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_quotation public.supplier_quotations%rowtype;
begin
  if not coalesce(private.is_procurement_manager(), false) then
    raise exception using errcode = '42501', message = 'Procurement manager role is required';
  end if;
  if p_quotation_id is null or p_status is null then
    raise exception using errcode = '22023', message = 'Quotation and status are required';
  end if;
  if p_status not in ('draft', 'received', 'approved', 'rejected', 'converted') then
    raise exception using errcode = '22023', message = 'Supplier quotation status is invalid';
  end if;

  select * into current_quotation
  from public.supplier_quotations
  where id = p_quotation_id
  for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Supplier quotation was not found';
  end if;

  update public.supplier_quotations
  set status = p_status,
      updated_at = now()
  where id = p_quotation_id;

  return jsonb_build_object(
    'quotationId', p_quotation_id,
    'previousStatus', current_quotation.status,
    'status', p_status
  );
end;
$$;

revoke all on function public.update_supplier_quotation_status(uuid, text) from public, anon, authenticated;
grant execute on function public.update_supplier_quotation_status(uuid, text) to authenticated;
