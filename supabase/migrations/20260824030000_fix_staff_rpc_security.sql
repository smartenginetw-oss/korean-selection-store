-- Staff RPC wrappers must be able to invoke the private, owner-checked
-- functions without granting direct execution on the private schema.
-- The private functions still verify the caller's owner role via auth.uid().

create or replace function public.list_backoffice_users()
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.list_backoffice_users();
$$;

create or replace function public.set_staff_member(p_email text, p_role text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.set_staff_member(p_email, p_role);
$$;

revoke all on function public.list_backoffice_users() from public, anon;
revoke all on function public.set_staff_member(text, text) from public, anon;
grant execute on function public.list_backoffice_users() to authenticated;
grant execute on function public.set_staff_member(text, text) to authenticated;
