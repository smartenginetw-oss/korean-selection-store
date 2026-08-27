-- The public projection may be called by the anonymous storefront client.
-- Keep the underlying settings table private and execute only this filtered
-- security-definer wrapper for the five public settings fields.

create or replace function public.get_store_settings()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.get_store_settings();
$$;

revoke all on function public.get_store_settings() from public, authenticated;
grant execute on function public.get_store_settings() to anon, service_role;
