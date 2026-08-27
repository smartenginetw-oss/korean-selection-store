-- Storefront settings are a small, intentionally public projection. Keep the
-- RPC invoker-owned and expose only the columns needed by the storefront.

drop policy if exists store_settings_public_read on public.store_settings;
create policy store_settings_public_read on public.store_settings
  for select to anon using (id = true);

grant select (brand_name, support_email, shipping_fee, reservation_minutes, preorder_enabled)
  on table public.store_settings to anon;

create or replace function public.get_store_settings()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'brandName', coalesce((select s.brand_name from public.store_settings s where s.id = true), 'GYEOT'),
    'supportEmail', coalesce((select s.support_email from public.store_settings s where s.id = true), 'smartengine.tw@gmail.com'),
    'shippingFee', coalesce((select s.shipping_fee from public.store_settings s where s.id = true), 80),
    'reservationMinutes', coalesce((select s.reservation_minutes from public.store_settings s where s.id = true), 15),
    'preorderEnabled', coalesce((select s.preorder_enabled from public.store_settings s where s.id = true), true)
  );
$$;

revoke all on function public.get_store_settings() from public, authenticated;
grant execute on function public.get_store_settings() to anon, service_role;
