-- Storefront reads use a deliberately anonymous client. Do not expose this
-- public projection to signed-in roles or the back-office API unnecessarily.

revoke execute on function public.get_store_settings() from authenticated;
grant execute on function public.get_store_settings() to anon, service_role;
