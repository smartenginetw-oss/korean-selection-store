-- A SECURITY DEFINER projection is intentional here: the underlying settings
-- table is private to the back office, while this function returns only the
-- five values that the public storefront needs.

drop view if exists public.store_settings_public;
revoke select on table public.store_settings from anon;
drop policy if exists store_settings_public_read on public.store_settings;

create or replace function public.get_store_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.get_store_settings();
$$;

revoke all on function public.get_store_settings() from public;
grant execute on function public.get_store_settings() to anon, authenticated, service_role;
