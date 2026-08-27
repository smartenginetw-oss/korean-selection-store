-- The profile bootstrap function is invoked only by the auth.users trigger.
-- It must not be callable through the PostgREST RPC surface.
revoke all on function public.handle_new_customer_user() from public, anon, authenticated;
