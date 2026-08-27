-- Do not grant anonymous access to the settings table itself. A view keeps
-- internal bookkeeping columns (updated_at/updated_by) out of the API.

revoke select on table public.store_settings from anon;
drop policy if exists store_settings_public_read on public.store_settings;

create or replace view public.store_settings_public as
select brand_name, support_email, shipping_fee, reservation_minutes, preorder_enabled
from public.store_settings
where id = true;

revoke all on table public.store_settings_public from public, authenticated;
grant select on table public.store_settings_public to anon, service_role;

create or replace function public.get_store_settings()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'brandName', coalesce((select s.brand_name from public.store_settings_public s), 'GYEOT'),
    'supportEmail', coalesce((select s.support_email from public.store_settings_public s), 'smartengine.tw@gmail.com'),
    'shippingFee', coalesce((select s.shipping_fee from public.store_settings_public s), 80),
    'reservationMinutes', coalesce((select s.reservation_minutes from public.store_settings_public s), 15),
    'preorderEnabled', coalesce((select s.preorder_enabled from public.store_settings_public s), true)
  );
$$;

revoke all on function public.get_store_settings() from public, authenticated;
grant execute on function public.get_store_settings() to anon, service_role;
