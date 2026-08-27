-- V1.5 procurement slice: supplier quotations and their line items.
-- A quotation keeps product and SKU snapshots so historical costs remain
-- readable even if a catalogue record is later archived.

create table if not exists public.supplier_quotations (
  id uuid primary key default gen_random_uuid(),
  supplier_id uuid not null references public.suppliers(id) on delete restrict,
  quote_number text not null check (char_length(quote_number) between 1 and 80),
  quote_date date not null default current_date,
  currency text not null default 'KRW' check (currency ~ '^[A-Z]{3}$'),
  exchange_rate numeric(14,6) not null default 1 check (exchange_rate > 0),
  status text not null default 'draft' check (status in ('draft', 'received', 'approved', 'rejected', 'converted')),
  note text check (note is null or char_length(note) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists supplier_quotations_number_lower_uq on public.supplier_quotations(lower(quote_number));
create index if not exists supplier_quotations_supplier_date_idx on public.supplier_quotations(supplier_id, quote_date desc);
create index if not exists supplier_quotations_status_idx on public.supplier_quotations(status, quote_date desc);

create table if not exists public.supplier_quotation_items (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.supplier_quotations(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null check (char_length(product_name) between 1 and 160),
  variant_name text,
  sku text,
  unit_cost numeric(14,2) not null check (unit_cost > 0),
  moq integer not null default 1 check (moq > 0),
  quantity integer not null default 1 check (quantity > 0),
  currency text not null default 'KRW' check (currency ~ '^[A-Z]{3}$'),
  total_cost numeric(16,2) generated always as (unit_cost * quantity) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists supplier_quotation_items_quotation_idx on public.supplier_quotation_items(quotation_id);
create index if not exists supplier_quotation_items_product_idx on public.supplier_quotation_items(product_id, variant_id);

drop trigger if exists supplier_quotations_updated_at on public.supplier_quotations;
create trigger supplier_quotations_updated_at before update on public.supplier_quotations
for each row execute function public.set_updated_at();

drop trigger if exists supplier_quotation_items_updated_at on public.supplier_quotation_items;
create trigger supplier_quotation_items_updated_at before update on public.supplier_quotation_items
for each row execute function public.set_updated_at();

alter table public.supplier_quotations enable row level security;
alter table public.supplier_quotation_items enable row level security;

drop policy if exists supplier_quotations_backoffice_select on public.supplier_quotations;
drop policy if exists supplier_quotations_backoffice_insert on public.supplier_quotations;
drop policy if exists supplier_quotations_backoffice_update on public.supplier_quotations;
drop policy if exists supplier_quotations_backoffice_delete_draft on public.supplier_quotations;

create policy supplier_quotations_backoffice_select on public.supplier_quotations
  for select to authenticated using (private.is_procurement_manager());

create policy supplier_quotations_backoffice_insert on public.supplier_quotations
  for insert to authenticated with check (private.is_procurement_manager());

create policy supplier_quotations_backoffice_update on public.supplier_quotations
  for update to authenticated using (private.is_procurement_manager())
  with check (private.is_procurement_manager());

create policy supplier_quotations_backoffice_delete_draft on public.supplier_quotations
  for delete to authenticated
  using (private.is_procurement_manager() and status = 'draft');

drop policy if exists supplier_quotation_items_backoffice_select on public.supplier_quotation_items;
drop policy if exists supplier_quotation_items_backoffice_insert on public.supplier_quotation_items;
drop policy if exists supplier_quotation_items_backoffice_update on public.supplier_quotation_items;
drop policy if exists supplier_quotation_items_backoffice_delete_draft on public.supplier_quotation_items;

create policy supplier_quotation_items_backoffice_select on public.supplier_quotation_items
  for select to authenticated using (private.is_procurement_manager());

create policy supplier_quotation_items_backoffice_insert on public.supplier_quotation_items
  for insert to authenticated
  with check (
    private.is_procurement_manager()
    and exists (
      select 1 from public.supplier_quotations q
      where q.id = quotation_id and q.status = 'draft'
    )
  );

create policy supplier_quotation_items_backoffice_update on public.supplier_quotation_items
  for update to authenticated
  using (
    private.is_procurement_manager()
    and exists (
      select 1 from public.supplier_quotations q
      where q.id = quotation_id and q.status = 'draft'
    )
  )
  with check (
    private.is_procurement_manager()
    and exists (
      select 1 from public.supplier_quotations q
      where q.id = quotation_id and q.status = 'draft'
    )
  );

create policy supplier_quotation_items_backoffice_delete_draft on public.supplier_quotation_items
  for delete to authenticated
  using (
    private.is_procurement_manager()
    and exists (
      select 1 from public.supplier_quotations q
      where q.id = quotation_id and q.status = 'draft'
    )
  );
