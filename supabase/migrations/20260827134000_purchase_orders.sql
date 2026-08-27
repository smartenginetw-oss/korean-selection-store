-- V1.5 procurement slice: purchase orders and their line items.

create table if not exists public.purchase_orders (
  id uuid primary key default gen_random_uuid(),
  po_number text not null check (char_length(po_number) between 1 and 80),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  quotation_id uuid references public.supplier_quotations(id) on delete set null,
  currency text not null default 'KRW' check (currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  ordered_date date not null default current_date,
  expected_date date,
  status text not null default 'draft' check (status in ('draft', 'ordered', 'partial_received', 'received', 'cancelled')),
  subtotal numeric(16,2) not null default 0 check (subtotal >= 0),
  shipping_cost numeric(14,2) not null default 0 check (shipping_cost >= 0),
  other_cost numeric(14,2) not null default 0 check (other_cost >= 0),
  total_cost numeric(16,2) not null default 0 check (total_cost >= 0),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint purchase_orders_expected_after_ordered check (expected_date is null or expected_date >= ordered_date)
);

create unique index if not exists purchase_orders_number_lower_uq on public.purchase_orders(lower(po_number));
create index if not exists purchase_orders_supplier_date_idx on public.purchase_orders(supplier_id, ordered_date desc);
create index if not exists purchase_orders_status_date_idx on public.purchase_orders(status, ordered_date desc);

create table if not exists public.purchase_order_items (
  id uuid primary key default gen_random_uuid(),
  purchase_order_id uuid not null references public.purchase_orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null check (char_length(product_name) between 1 and 160),
  variant_name text,
  sku text,
  unit_cost numeric(14,2) not null check (unit_cost > 0),
  quantity integer not null default 1 check (quantity > 0),
  currency text not null default 'KRW' check (currency ~ '^[A-Z]{3}$'),
  total_cost numeric(16,2) generated always as (unit_cost * quantity) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists purchase_order_items_order_idx on public.purchase_order_items(purchase_order_id);
create index if not exists purchase_order_items_product_idx on public.purchase_order_items(product_id, variant_id);

create or replace function private.refresh_purchase_order_totals()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_id uuid;
begin
  target_id := coalesce(new.purchase_order_id, old.purchase_order_id);
  update public.purchase_orders po
  set subtotal = coalesce((select sum(item.total_cost) from public.purchase_order_items item where item.purchase_order_id = target_id), 0),
      total_cost = coalesce((select sum(item.total_cost) from public.purchase_order_items item where item.purchase_order_id = target_id), 0) + po.shipping_cost + po.other_cost,
      updated_at = now()
  where po.id = target_id;
  return null;
end;
$$;

revoke all on function private.refresh_purchase_order_totals() from public, anon, authenticated;

drop trigger if exists purchase_orders_updated_at on public.purchase_orders;
create trigger purchase_orders_updated_at before update on public.purchase_orders
for each row execute function public.set_updated_at();

drop trigger if exists purchase_order_items_updated_at on public.purchase_order_items;
create trigger purchase_order_items_updated_at before update on public.purchase_order_items
for each row execute function public.set_updated_at();

drop trigger if exists purchase_order_items_refresh_totals on public.purchase_order_items;
create trigger purchase_order_items_refresh_totals after insert or update or delete on public.purchase_order_items
for each row execute function private.refresh_purchase_order_totals();

drop trigger if exists purchase_orders_refresh_totals on public.purchase_orders;
create trigger purchase_orders_refresh_totals after update of shipping_cost, other_cost on public.purchase_orders
for each row execute function private.refresh_purchase_order_totals();

alter table public.purchase_orders enable row level security;
alter table public.purchase_order_items enable row level security;

drop policy if exists purchase_orders_backoffice_select on public.purchase_orders;
drop policy if exists purchase_orders_backoffice_insert on public.purchase_orders;
drop policy if exists purchase_orders_backoffice_update on public.purchase_orders;
drop policy if exists purchase_orders_backoffice_delete_draft on public.purchase_orders;

create policy purchase_orders_backoffice_select on public.purchase_orders
  for select to authenticated using (private.is_procurement_manager());

create policy purchase_orders_backoffice_insert on public.purchase_orders
  for insert to authenticated with check (private.is_procurement_manager());

create policy purchase_orders_backoffice_update on public.purchase_orders
  for update to authenticated using (private.is_procurement_manager())
  with check (private.is_procurement_manager());

create policy purchase_orders_backoffice_delete_draft on public.purchase_orders
  for delete to authenticated using (private.is_procurement_manager() and status = 'draft');

drop policy if exists purchase_order_items_backoffice_select on public.purchase_order_items;
drop policy if exists purchase_order_items_backoffice_insert on public.purchase_order_items;
drop policy if exists purchase_order_items_backoffice_update on public.purchase_order_items;
drop policy if exists purchase_order_items_backoffice_delete_draft on public.purchase_order_items;

create policy purchase_order_items_backoffice_select on public.purchase_order_items
  for select to authenticated using (private.is_procurement_manager());

create policy purchase_order_items_backoffice_insert on public.purchase_order_items
  for insert to authenticated
  with check (
    private.is_procurement_manager()
    and exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and po.status = 'draft')
  );

create policy purchase_order_items_backoffice_update on public.purchase_order_items
  for update to authenticated
  using (
    private.is_procurement_manager()
    and exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and po.status = 'draft')
  )
  with check (
    private.is_procurement_manager()
    and exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and po.status = 'draft')
  );

create policy purchase_order_items_backoffice_delete_draft on public.purchase_order_items
  for delete to authenticated
  using (
    private.is_procurement_manager()
    and exists (select 1 from public.purchase_orders po where po.id = purchase_order_id and po.status = 'draft')
  );
