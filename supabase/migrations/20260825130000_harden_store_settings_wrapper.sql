-- The public wrapper is intentionally callable by the storefront, but does not
-- need SECURITY DEFINER. The private function remains the controlled,
-- SECURITY DEFINER implementation that returns only public settings fields.

create or replace function public.get_store_settings()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.get_store_settings();
$$;

revoke all on function public.get_store_settings() from public;
grant execute on function public.get_store_settings() to anon, authenticated, service_role;
