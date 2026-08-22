create extension if not exists pgcrypto;
create schema if not exists private;

create or replace function public.set_updated_at()
returns trigger language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer', 'admin')),
  granted_by uuid references auth.users(id) on delete restrict,
  created_at timestamptz not null default now()
);

create or replace function private.is_admin()
returns boolean language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

create table public.addresses (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  recipient_name text not null check (char_length(recipient_name) between 1 and 80),
  phone text not null check (char_length(phone) between 8 and 20),
  postal_code text not null check (char_length(postal_code) between 3 and 10),
  city text not null,
  district text not null,
  address_line text not null check (char_length(address_line) <= 160),
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index addresses_profile_idx on public.addresses(profile_id, is_default);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.categories(id) on delete restrict,
  name text not null,
  slug text not null,
  description text not null default '',
  image_path text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint categories_slug_unique unique nulls not distinct (slug),
  constraint categories_not_self_parent check (parent_id is null or parent_id <> id)
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  slug text not null unique,
  description text not null default '',
  material text,
  size_guide text,
  model_info text,
  origin text,
  care_instructions text,
  original_price integer check (original_price is null or original_price >= 0),
  sale_price integer not null check (sale_price > 0),
  cost_price integer check (cost_price is null or cost_price >= 0),
  status text not null default 'draft' check (status in ('draft', 'active', 'archived')),
  tags text[] not null default '{}',
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_price_order check (original_price is null or original_price >= sale_price)
);
create index products_active_published_idx on public.products(published_at desc) where status = 'active';

create table public.product_categories (
  product_id uuid not null references public.products(id) on delete cascade,
  category_id uuid not null references public.categories(id) on delete restrict,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (product_id, category_id)
);
create index product_categories_category_idx on public.product_categories(category_id, product_id);

create table public.product_options (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(product_id, name)
);

create table public.product_option_values (
  id uuid primary key default gen_random_uuid(),
  option_id uuid not null references public.product_options(id) on delete cascade,
  value text not null,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique(option_id, value)
);

create table public.product_variants (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete restrict,
  sku text not null,
  status text not null default 'active' check (status in ('active', 'inactive', 'archived')),
  price_override integer check (price_override is null or price_override > 0),
  cost_override integer check (cost_override is null or cost_override >= 0),
  fulfillment_mode text not null check (fulfillment_mode in ('in_stock', 'preorder', 'unavailable')),
  preorder_limit integer check (preorder_limit is null or preorder_limit >= 0),
  preorder_available_at date,
  weight_grams integer check (weight_grams is null or weight_grams >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index product_variants_sku_lower_uq on public.product_variants(lower(sku));
create index product_variants_product_status_idx on public.product_variants(product_id, status);

create table public.variant_option_values (
  variant_id uuid not null references public.product_variants(id) on delete cascade,
  option_value_id uuid not null references public.product_option_values(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (variant_id, option_value_id)
);
create index variant_option_values_option_idx on public.variant_option_values(option_value_id, variant_id);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  variant_id uuid references public.product_variants(id) on delete set null,
  storage_path text not null,
  alt_text text not null default '',
  sort_order integer not null default 0,
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);
create index product_images_product_sort_idx on public.product_images(product_id, sort_order);

create table public.inventory_levels (
  variant_id uuid primary key references public.product_variants(id) on delete restrict,
  on_hand integer not null default 0 check (on_hand >= 0),
  reserved integer not null default 0 check (reserved >= 0 and reserved <= on_hand),
  low_stock_threshold integer not null default 3 check (low_stock_threshold >= 0),
  updated_at timestamptz not null default now()
);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  profile_id uuid references public.profiles(id) on delete set null,
  email text not null check (char_length(email) <= 254),
  phone text not null check (char_length(phone) between 8 and 20),
  recipient_name text not null check (char_length(recipient_name) between 1 and 80),
  postal_code text not null,
  city text not null,
  district text not null,
  address_line text not null check (char_length(address_line) <= 160),
  currency text not null default 'TWD' check (currency = 'TWD'),
  subtotal integer not null check (subtotal >= 0),
  discount_total integer not null default 0 check (discount_total >= 0),
  shipping_total integer not null default 0 check (shipping_total >= 0),
  grand_total integer not null check (grand_total >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  fulfillment_status text not null default 'unfulfilled' check (fulfillment_status in ('unfulfilled', 'awaiting_stock', 'processing', 'shipped', 'delivered', 'cancelled')),
  order_status text not null default 'pending_payment' check (order_status in ('pending_payment', 'confirmed', 'completed', 'cancelled', 'expired', 'exception')),
  stock_mode text not null check (stock_mode in ('in_stock', 'preorder', 'mixed')),
  customer_note text check (customer_note is null or char_length(customer_note) <= 500),
  lookup_token_hash text,
  placed_at timestamptz not null default now(),
  cancelled_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint orders_total_matches check (grand_total = subtotal - discount_total + shipping_total)
);
create index orders_profile_created_idx on public.orders(profile_id, created_at desc);
create index orders_payment_created_idx on public.orders(payment_status, created_at desc);
create index orders_fulfillment_created_idx on public.orders(fulfillment_status, created_at desc);
create index orders_email_created_idx on public.orders(email, created_at desc);

create table public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  product_id uuid references public.products(id) on delete set null,
  variant_id uuid references public.product_variants(id) on delete set null,
  product_name text not null,
  variant_name text not null,
  sku text not null,
  selected_options jsonb not null default '{}',
  unit_price integer not null check (unit_price >= 0),
  unit_cost integer check (unit_cost is null or unit_cost >= 0),
  quantity integer not null check (quantity > 0),
  line_total integer not null check (line_total >= 0),
  fulfillment_mode text not null check (fulfillment_mode in ('in_stock', 'preorder')),
  preorder_available_at date,
  image_path text,
  created_at timestamptz not null default now(),
  constraint order_items_line_total_matches check (line_total = unit_price * quantity)
);
create index order_items_order_idx on public.order_items(order_id);

create table public.inventory_reservations (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  order_id uuid not null references public.orders(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  status text not null default 'active' check (status in ('active', 'committed', 'released', 'expired')),
  expires_at timestamptz not null,
  committed_at timestamptz,
  released_at timestamptz,
  created_at timestamptz not null default now()
);
create index inventory_reservations_expiry_idx on public.inventory_reservations(expires_at) where status = 'active';
create index inventory_reservations_order_idx on public.inventory_reservations(order_id, variant_id);

create table public.inventory_movements (
  id uuid primary key default gen_random_uuid(),
  variant_id uuid not null references public.product_variants(id) on delete restrict,
  order_id uuid references public.orders(id) on delete restrict,
  admin_user_id uuid references auth.users(id) on delete restrict,
  type text not null check (type in ('purchase_received', 'sale_committed', 'cancellation_return', 'refund_return', 'manual_adjustment', 'damage')),
  quantity_delta integer not null check (quantity_delta <> 0),
  balance_after integer not null check (balance_after >= 0),
  reason text,
  idempotency_key text not null unique,
  created_at timestamptz not null default now()
);
create index inventory_movements_variant_created_idx on public.inventory_movements(variant_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  provider text not null,
  provider_payment_id text,
  idempotency_key text not null unique,
  amount integer not null check (amount >= 0),
  currency text not null default 'TWD' check (currency = 'TWD'),
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed', 'refunded', 'partially_refunded')),
  failure_code text,
  failure_message text,
  refunded_amount integer not null default 0 check (refunded_amount >= 0 and refunded_amount <= amount),
  paid_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index payments_provider_id_uq on public.payments(provider, provider_payment_id) where provider_payment_id is not null;
create index payments_order_created_idx on public.payments(order_id, created_at desc);

create table public.payment_events (
  id uuid primary key default gen_random_uuid(),
  payment_id uuid references public.payments(id) on delete restrict,
  provider_event_id text not null unique,
  event_type text not null,
  payload jsonb not null default '{}',
  signature_valid boolean not null default false,
  processing_status text not null default 'pending' check (processing_status in ('pending', 'processing', 'processed', 'failed', 'dead_letter')),
  attempt_count integer not null default 0 check (attempt_count between 0 and 10),
  processed_at timestamptz,
  error_message text,
  created_at timestamptz not null default now()
);

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  carrier text not null,
  tracking_number text not null,
  status text not null default 'preparing' check (status in ('preparing', 'shipped', 'delivered', 'exception')),
  shipped_at timestamptz,
  delivered_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index shipments_order_idx on public.shipments(order_id, created_at desc);

create table public.order_timeline (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete restrict,
  event_type text not null,
  from_status text,
  to_status text,
  actor_type text not null check (actor_type in ('system', 'customer', 'admin')),
  actor_user_id uuid references auth.users(id) on delete restrict,
  note text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index order_timeline_order_created_idx on public.order_timeline(order_id, created_at);

create table public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  resource_type text not null,
  resource_id uuid,
  changed_fields text[] not null default '{}',
  request_id text,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index admin_audit_logs_admin_created_idx on public.admin_audit_logs(admin_user_id, created_at desc);

create table public.consent_records (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  order_id uuid references public.orders(id) on delete set null,
  consent_type text not null,
  document_version text not null,
  granted boolean not null,
  source text not null,
  created_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles for each row execute function public.set_updated_at();
create trigger addresses_updated_at before update on public.addresses for each row execute function public.set_updated_at();
create trigger categories_updated_at before update on public.categories for each row execute function public.set_updated_at();
create trigger products_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger product_variants_updated_at before update on public.product_variants for each row execute function public.set_updated_at();
create trigger inventory_levels_updated_at before update on public.inventory_levels for each row execute function public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute function public.set_updated_at();
create trigger payments_updated_at before update on public.payments for each row execute function public.set_updated_at();
create trigger shipments_updated_at before update on public.shipments for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.addresses enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_options enable row level security;
alter table public.product_option_values enable row level security;
alter table public.product_variants enable row level security;
alter table public.variant_option_values enable row level security;
alter table public.product_images enable row level security;
alter table public.inventory_levels enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.inventory_reservations enable row level security;
alter table public.inventory_movements enable row level security;
alter table public.payments enable row level security;
alter table public.payment_events enable row level security;
alter table public.shipments enable row level security;
alter table public.order_timeline enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.consent_records enable row level security;

create policy "profiles own select" on public.profiles for select to authenticated using (id = auth.uid() or private.is_admin());
create policy "profiles own update" on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
create policy "roles own select" on public.user_roles for select to authenticated using (user_id = auth.uid() or private.is_admin());
create policy "addresses own all" on public.addresses for all to authenticated using (profile_id = auth.uid() or private.is_admin()) with check (profile_id = auth.uid() or private.is_admin());

create policy "categories public active" on public.categories for select to anon, authenticated using (is_active or private.is_admin());
create policy "products public active" on public.products for select to anon, authenticated using (status = 'active' or private.is_admin());
create policy "product categories public read" on public.product_categories for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or private.is_admin())));
create policy "product options public read" on public.product_options for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or private.is_admin())));
create policy "option values public read" on public.product_option_values for select to anon, authenticated using (exists (select 1 from public.product_options po join public.products p on p.id = po.product_id where po.id = option_id and (p.status = 'active' or private.is_admin())));
create policy "variants public active" on public.product_variants for select to anon, authenticated using ((status = 'active' and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')) or private.is_admin());
create policy "variant values public read" on public.variant_option_values for select to anon, authenticated using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id where v.id = variant_id and v.status = 'active' and p.status = 'active') or private.is_admin());
create policy "product images public read" on public.product_images for select to anon, authenticated using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or private.is_admin())));

create policy "orders own select" on public.orders for select to authenticated using (profile_id = auth.uid() or private.is_admin());
create policy "order items own select" on public.order_items for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or private.is_admin())));
create policy "payments own select" on public.payments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or private.is_admin())));
create policy "shipments own select" on public.shipments for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or private.is_admin())));
create policy "timeline own select" on public.order_timeline for select to authenticated using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or private.is_admin())));

create policy "admin manage categories" on public.categories for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage products" on public.products for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage product categories" on public.product_categories for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage options" on public.product_options for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage option values" on public.product_option_values for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage variants" on public.product_variants for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage variant values" on public.variant_option_values for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage images" on public.product_images for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin read inventory" on public.inventory_levels for select to authenticated using (private.is_admin());
create policy "admin read reservations" on public.inventory_reservations for select to authenticated using (private.is_admin());
create policy "admin read movements" on public.inventory_movements for select to authenticated using (private.is_admin());
create policy "admin manage orders" on public.orders for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage order items" on public.order_items for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage payments" on public.payments for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin read payment events" on public.payment_events for select to authenticated using (private.is_admin());
create policy "admin manage shipments" on public.shipments for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin manage timeline" on public.order_timeline for all to authenticated using (private.is_admin()) with check (private.is_admin());
create policy "admin read audit" on public.admin_audit_logs for select to authenticated using (private.is_admin());
create policy "consent own select" on public.consent_records for select to authenticated using (profile_id = auth.uid() or private.is_admin());

revoke all on function private.is_admin() from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.is_admin() to anon, authenticated;

comment on table public.orders is 'Contains customer PII. Do not expose to anonymous Data API access.';
comment on table public.payment_events is 'Payload must be redacted before storage; never store secrets or full payment credentials.';
comment on table public.admin_audit_logs is 'Append-only security audit metadata without copied customer PII.';

-- Data API hardening: deny-by-default grants, then allow only the operations
-- that the storefront and authenticated customer/admin flows require.
do $$
declare
  table_record record;
begin
  for table_record in
    select tablename
    from pg_tables
    where schemaname = 'public'
  loop
    execute format(
      'revoke all on table public.%I from anon, authenticated',
      table_record.tablename
    );
  end loop;
end;
$$;

alter default privileges in schema public
  revoke all on tables from anon, authenticated;
alter default privileges in schema public
  revoke all on sequences from anon, authenticated;

grant select on table
  public.categories,
  public.products,
  public.product_categories,
  public.product_options,
  public.product_option_values,
  public.product_variants,
  public.variant_option_values,
  public.product_images
to anon, authenticated;

grant select, insert, update, delete on table
  public.profiles,
  public.addresses
to authenticated;

grant select on table
  public.orders,
  public.order_items,
  public.payments,
  public.shipments,
  public.order_timeline,
  public.consent_records
to authenticated;

grant all on table
  public.categories,
  public.products,
  public.product_categories,
  public.product_options,
  public.product_option_values,
  public.product_variants,
  public.variant_option_values,
  public.product_images,
  public.orders,
  public.order_items,
  public.payments,
  public.shipments,
  public.order_timeline
to authenticated;

grant select on table
  public.inventory_levels,
  public.inventory_reservations,
  public.inventory_movements,
  public.payment_events,
  public.admin_audit_logs
to authenticated;

comment on schema public is 'Public Data API access is deny-by-default; RLS policies define row ownership and admin access.';
