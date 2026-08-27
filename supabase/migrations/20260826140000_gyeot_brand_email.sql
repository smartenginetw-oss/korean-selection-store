-- Move the public support contact to the newly created GYEOT brand mailbox.
-- Preserve any deliberate custom address an owner may already have entered.

alter table public.store_settings
  alter column support_email set default 'gyeot.official@gmail.com';

update public.store_settings
set support_email = 'gyeot.official@gmail.com',
    updated_at = now()
where id = true
  and lower(support_email) = 'smartengine.tw@gmail.com';

create or replace function private.get_store_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'brandName', coalesce((select s.brand_name from public.store_settings s where s.id = true), 'GYEOT'),
    'supportEmail', coalesce((select s.support_email from public.store_settings s where s.id = true), 'gyeot.official@gmail.com'),
    'shippingFee', coalesce((select s.shipping_fee from public.store_settings s where s.id = true), 80),
    'reservationMinutes', coalesce((select s.reservation_minutes from public.store_settings s where s.id = true), 15),
    'preorderEnabled', coalesce((select s.preorder_enabled from public.store_settings s where s.id = true), true),
    'instagramUrl', (select s.instagram_url from public.store_settings s where s.id = true),
    'threadsUrl', (select s.threads_url from public.store_settings s where s.id = true),
    'facebookUrl', (select s.facebook_url from public.store_settings s where s.id = true),
    'lineOfficialUrl', (select s.line_official_url from public.store_settings s where s.id = true)
  );
$$;

revoke all on function private.get_store_settings() from public, anon, authenticated;
grant execute on function private.get_store_settings() to service_role;
