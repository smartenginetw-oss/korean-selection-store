create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

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
