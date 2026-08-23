-- V1 employee role templates.
-- The owner can assign one of three employee profiles:
-- staff (full operations), catalog_staff (products/inventory), or
-- order_staff (orders/customers/coupons/reports).

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('customer', 'staff', 'catalog_staff', 'order_staff', 'admin'));

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'staff', 'catalog_staff', 'order_staff')
  );
$$;

create or replace function private.can_manage_catalog()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'staff', 'catalog_staff')
  );
$$;

create or replace function private.can_manage_orders()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'staff', 'order_staff')
  );
$$;

create or replace function private.can_manage_customers()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_orders();
$$;

create or replace function private.can_manage_coupons()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.can_manage_orders();
$$;

create or replace function private.can_manage_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'staff')
  );
$$;

create or replace function private.can_view_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'staff', 'order_staff')
  );
$$;

create or replace function private.list_backoffice_users()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not coalesce(private.is_owner(), false) then
    raise exception using errcode = '42501', message = 'Owner role is required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', u.id,
    'email', u.email,
    'displayName', p.display_name,
    'role', ur.role,
    'createdAt', u.created_at,
    'lastSignInAt', u.last_sign_in_at
  ) order by u.created_at), '[]'::jsonb)
  into result
  from auth.users u
  join public.user_roles ur on ur.user_id = u.id
    and ur.role in ('admin', 'staff', 'catalog_staff', 'order_staff')
  left join public.profiles p on p.id = u.id;

  return result;
end;
$$;

create or replace function private.set_staff_member(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := lower(trim(coalesce(p_role, '')));
  v_user_id uuid;
  v_current_role text;
begin
  if not coalesce(private.is_owner(), false) then
    raise exception using errcode = '42501', message = 'Owner role is required';
  end if;
  if v_email = '' or length(v_email) > 254 or position('@' in v_email) < 2 then
    raise exception using errcode = '22023', message = 'A valid employee email is required';
  end if;
  if v_role not in ('staff', 'catalog_staff', 'order_staff', 'customer') then
    raise exception using errcode = '22023', message = 'Employee role is invalid';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email limit 1;
  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'Auth user was not found. Create the account in Supabase Auth first.';
  end if;

  select role into v_current_role from public.user_roles where user_id = v_user_id;
  if v_current_role = 'admin' and v_role <> 'admin' then
    raise exception using errcode = '42501', message = 'The owner role cannot be changed here';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (v_user_id, v_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by;

  insert into public.admin_audit_logs (admin_user_id, action, resource_type, resource_id, changed_fields)
  values (auth.uid(), 'staff.role_update', 'user', v_user_id, array['role']::text[]);

  return jsonb_build_object('userId', v_user_id, 'email', v_email, 'role', v_role);
end;
$$;

-- RLS capability boundaries for direct table access.
drop policy if exists "profiles own select" on public.profiles;
create policy "profiles own select" on public.profiles for select to authenticated
  using (id = auth.uid() or private.can_manage_customers());
drop policy if exists "addresses own all" on public.addresses;
create policy "addresses own all" on public.addresses for all to authenticated
  using (profile_id = auth.uid() or private.can_manage_customers())
  with check (profile_id = auth.uid() or private.can_manage_customers());

drop policy if exists "categories public active" on public.categories;
create policy "categories public active" on public.categories for select to anon, authenticated
  using (is_active or private.can_manage_catalog());
drop policy if exists "products public active" on public.products;
create policy "products public active" on public.products for select to anon, authenticated
  using (status = 'active' or private.can_manage_catalog());
drop policy if exists "product categories public read" on public.product_categories;
create policy "product categories public read" on public.product_categories for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or private.can_manage_catalog())));
drop policy if exists "product options public read" on public.product_options;
create policy "product options public read" on public.product_options for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or private.can_manage_catalog())));
drop policy if exists "option values public read" on public.product_option_values;
create policy "option values public read" on public.product_option_values for select to anon, authenticated
  using (exists (select 1 from public.product_options po join public.products p on p.id = po.product_id where po.id = option_id and (p.status = 'active' or private.can_manage_catalog())));
drop policy if exists "variants public active" on public.product_variants;
create policy "variants public active" on public.product_variants for select to anon, authenticated
  using ((status = 'active' and exists (select 1 from public.products p where p.id = product_id and p.status = 'active')) or private.can_manage_catalog());
drop policy if exists "variant values public read" on public.variant_option_values;
create policy "variant values public read" on public.variant_option_values for select to anon, authenticated
  using (exists (select 1 from public.product_variants v join public.products p on p.id = v.product_id where v.id = variant_id and v.status = 'active' and p.status = 'active') or private.can_manage_catalog());
drop policy if exists "product images public read" on public.product_images;
create policy "product images public read" on public.product_images for select to anon, authenticated
  using (exists (select 1 from public.products p where p.id = product_id and (p.status = 'active' or private.can_manage_catalog())));

drop policy if exists "admin manage categories" on public.categories;
create policy "admin manage categories" on public.categories for all to authenticated using (private.can_manage_catalog()) with check (private.can_manage_catalog());
drop policy if exists "admin manage products" on public.products;
create policy "admin manage products" on public.products for all to authenticated using (private.can_manage_catalog()) with check (private.can_manage_catalog());
drop policy if exists "admin manage product categories" on public.product_categories;
create policy "admin manage product categories" on public.product_categories for all to authenticated using (private.can_manage_catalog()) with check (private.can_manage_catalog());
drop policy if exists "admin manage options" on public.product_options;
create policy "admin manage options" on public.product_options for all to authenticated using (private.can_manage_catalog()) with check (private.can_manage_catalog());
drop policy if exists "admin manage option values" on public.product_option_values;
create policy "admin manage option values" on public.product_option_values for all to authenticated using (private.can_manage_catalog()) with check (private.can_manage_catalog());
drop policy if exists "admin manage variants" on public.product_variants;
create policy "admin manage variants" on public.product_variants for all to authenticated using (private.can_manage_catalog()) with check (private.can_manage_catalog());
drop policy if exists "admin manage variant values" on public.variant_option_values;
create policy "admin manage variant values" on public.variant_option_values for all to authenticated using (private.can_manage_catalog()) with check (private.can_manage_catalog());
drop policy if exists "admin manage images" on public.product_images;
create policy "admin manage images" on public.product_images for all to authenticated using (private.can_manage_catalog()) with check (private.can_manage_catalog());

drop policy if exists "admin read inventory" on public.inventory_levels;
create policy "admin read inventory" on public.inventory_levels for select to authenticated using (private.can_manage_catalog());
drop policy if exists "admin read reservations" on public.inventory_reservations;
create policy "admin read reservations" on public.inventory_reservations for select to authenticated using (private.can_manage_catalog());
drop policy if exists "admin read movements" on public.inventory_movements;
create policy "admin read movements" on public.inventory_movements for select to authenticated using (private.can_manage_catalog());

drop policy if exists "orders own select" on public.orders;
create policy "orders own select" on public.orders for select to authenticated
  using (profile_id = auth.uid() or private.can_manage_orders());
drop policy if exists "order items own select" on public.order_items;
create policy "order items own select" on public.order_items for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or private.can_manage_orders())));
drop policy if exists "payments own select" on public.payments;
create policy "payments own select" on public.payments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or private.can_manage_orders())));
drop policy if exists "shipments own select" on public.shipments;
create policy "shipments own select" on public.shipments for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or private.can_manage_orders())));
drop policy if exists "timeline own select" on public.order_timeline;
create policy "timeline own select" on public.order_timeline for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_id and (o.profile_id = auth.uid() or private.can_manage_orders())));

drop policy if exists "admin manage orders" on public.orders;
create policy "admin manage orders" on public.orders for all to authenticated using (private.can_manage_orders()) with check (private.can_manage_orders());
drop policy if exists "admin manage order items" on public.order_items;
create policy "admin manage order items" on public.order_items for all to authenticated using (private.can_manage_orders()) with check (private.can_manage_orders());
drop policy if exists "admin manage payments" on public.payments;
create policy "admin manage payments" on public.payments for all to authenticated using (private.can_manage_orders()) with check (private.can_manage_orders());
drop policy if exists "admin read payment events" on public.payment_events;
create policy "admin read payment events" on public.payment_events for select to authenticated using (private.can_manage_orders());
drop policy if exists "admin manage shipments" on public.shipments;
create policy "admin manage shipments" on public.shipments for all to authenticated using (private.can_manage_orders()) with check (private.can_manage_orders());
drop policy if exists "admin manage timeline" on public.order_timeline;
create policy "admin manage timeline" on public.order_timeline for all to authenticated using (private.can_manage_orders()) with check (private.can_manage_orders());
drop policy if exists "consent own select" on public.consent_records;
create policy "consent own select" on public.consent_records for select to authenticated
  using (profile_id = auth.uid() or private.can_manage_customers());

drop policy if exists coupons_admin_select on public.coupons;
drop policy if exists coupons_admin_insert on public.coupons;
drop policy if exists coupons_admin_update on public.coupons;
create policy coupons_admin_select on public.coupons for select to authenticated using (private.can_manage_coupons());
create policy coupons_admin_insert on public.coupons for insert to authenticated with check (private.can_manage_coupons());
create policy coupons_admin_update on public.coupons for update to authenticated using (private.can_manage_coupons()) with check (private.can_manage_coupons());

drop policy if exists store_pages_admin_select on public.store_pages;
drop policy if exists store_pages_admin_insert on public.store_pages;
drop policy if exists store_pages_admin_update on public.store_pages;
create policy store_pages_admin_select on public.store_pages for select to authenticated using (private.can_manage_content());
create policy store_pages_admin_insert on public.store_pages for insert to authenticated with check (private.can_manage_content());
create policy store_pages_admin_update on public.store_pages for update to authenticated using (private.can_manage_content()) with check (private.can_manage_content());

drop policy if exists "admin product image upload" on storage.objects;
drop policy if exists "admin product image update" on storage.objects;
drop policy if exists "admin product image delete" on storage.objects;
create policy "admin product image upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'product-images' and private.can_manage_catalog());
create policy "admin product image update" on storage.objects for update to authenticated
  using (bucket_id = 'product-images' and private.can_manage_catalog())
  with check (bucket_id = 'product-images' and private.can_manage_catalog());
create policy "admin product image delete" on storage.objects for delete to authenticated
  using (bucket_id = 'product-images' and private.can_manage_catalog());

-- RPC wrappers enforce the capability before entering the existing atomic
-- security-definer transaction functions.
create or replace function public.create_admin_product(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if not coalesce(private.can_manage_catalog(), false) then
    raise exception using errcode = '42501', message = 'Catalog role is required';
  end if;
  return private.create_admin_product(p_payload);
end;
$$;

create or replace function public.update_admin_product(p_product_id uuid, p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if not coalesce(private.can_manage_catalog(), false) then
    raise exception using errcode = '42501', message = 'Catalog role is required';
  end if;
  return private.update_admin_product(p_product_id, p_payload);
end;
$$;

create or replace function public.adjust_admin_inventory(p_variant_id uuid, p_on_hand integer, p_low_stock_threshold integer, p_reason text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if not coalesce(private.can_manage_catalog(), false) then
    raise exception using errcode = '42501', message = 'Catalog role is required';
  end if;
  return private.adjust_admin_inventory(p_variant_id, p_on_hand, p_low_stock_threshold, p_reason);
end;
$$;

create or replace function public.update_admin_order_fulfillment(p_payload jsonb)
returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if not coalesce(private.can_manage_orders(), false) then
    raise exception using errcode = '42501', message = 'Order role is required';
  end if;
  return private.update_admin_order_fulfillment(p_payload);
end;
$$;

grant execute on function public.create_admin_product(jsonb) to authenticated;
grant execute on function public.update_admin_product(uuid, jsonb) to authenticated;
grant execute on function public.adjust_admin_inventory(uuid, integer, integer, text) to authenticated;
grant execute on function public.update_admin_order_fulfillment(jsonb) to authenticated;
