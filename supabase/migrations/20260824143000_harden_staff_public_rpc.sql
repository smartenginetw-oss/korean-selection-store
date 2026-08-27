-- Keep the public RPC entry points invoker-owned. The private functions remain
-- SECURITY DEFINER and enforce the owner check with auth.uid(), while the API
-- wrapper itself no longer runs with postgres privileges.

create or replace function public.list_backoffice_users()
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.list_backoffice_users();
$$;

create or replace function public.set_staff_member(p_email text, p_role text)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_staff_member(p_email, p_role);
$$;

revoke all on function private.list_backoffice_users() from public, anon;
revoke all on function private.set_staff_member(text, text) from public, anon;
grant execute on function private.list_backoffice_users() to authenticated;
grant execute on function private.set_staff_member(text, text) to authenticated;

revoke all on function public.list_backoffice_users() from public, anon;
revoke all on function public.set_staff_member(text, text) from public, anon;
grant execute on function public.list_backoffice_users() to authenticated;
grant execute on function public.set_staff_member(text, text) to authenticated;
