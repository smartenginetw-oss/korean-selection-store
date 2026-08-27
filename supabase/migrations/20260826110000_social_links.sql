-- Optional public social links managed by the owner.
-- Only HTTPS links to the supported social domains are accepted.

alter table public.store_settings
  add column if not exists instagram_url text,
  add column if not exists threads_url text,
  add column if not exists facebook_url text;

alter table public.store_settings
  drop constraint if exists store_settings_instagram_url_check,
  drop constraint if exists store_settings_threads_url_check,
  drop constraint if exists store_settings_facebook_url_check;

alter table public.store_settings
  add constraint store_settings_instagram_url_check check (
    instagram_url is null
    or instagram_url ~ '^https://(www\.)?instagram\.com/[A-Za-z0-9._-]+/?$'
  ),
  add constraint store_settings_threads_url_check check (
    threads_url is null
    or threads_url ~ '^https://(www\.)?threads\.net/@[A-Za-z0-9._-]+/?$'
  ),
  add constraint store_settings_facebook_url_check check (
    facebook_url is null
    or facebook_url ~ '^https://(www\.)?facebook\.com/[A-Za-z0-9._-]+/?$'
  );

create or replace function private.get_store_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'brandName', coalesce((select s.brand_name from public.store_settings s where s.id = true), 'GYEOT'),
    'supportEmail', coalesce((select s.support_email from public.store_settings s where s.id = true), 'smartengine.tw@gmail.com'),
    'shippingFee', coalesce((select s.shipping_fee from public.store_settings s where s.id = true), 80),
    'reservationMinutes', coalesce((select s.reservation_minutes from public.store_settings s where s.id = true), 15),
    'preorderEnabled', coalesce((select s.preorder_enabled from public.store_settings s where s.id = true), true),
    'instagramUrl', (select s.instagram_url from public.store_settings s where s.id = true),
    'threadsUrl', (select s.threads_url from public.store_settings s where s.id = true),
    'facebookUrl', (select s.facebook_url from public.store_settings s where s.id = true)
  );
$$;

revoke all on function private.get_store_settings() from public, anon, authenticated;
grant execute on function private.get_store_settings() to service_role;
