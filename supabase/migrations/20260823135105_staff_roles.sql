-- Back-office role separation.
-- V1 keeps staff operational access, while only the owner can change roles or
-- store-wide settings. Staff accounts must already exist in Supabase Auth.

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check check (role in ('customer', 'staff', 'admin'));

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'staff')
  );
$$;

create or replace function private.is_owner()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function private.is_owner() to authenticated;

drop policy if exists store_settings_admin_select on public.store_settings;
drop policy if exists store_settings_admin_update on public.store_settings;
create policy store_settings_owner_select on public.store_settings
  for select to authenticated using (private.is_owner());
create policy store_settings_owner_update on public.store_settings
  for update to authenticated using (private.is_owner()) with check (private.is_owner());

create or replace function private.list_backoffice_users()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not coalesce(private.is_owner(), false) then
    raise exception using errcode = '42501', message = 'Owner role is required';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'userId', u.id,
    'email', u.email,
    'displayName', p.display_name,
    'role', ur.role,
    'createdAt', u.created_at,
    'lastSignInAt', u.last_sign_in_at
  ) order by u.created_at), '[]'::jsonb)
  into result
  from auth.users u
  join public.user_roles ur on ur.user_id = u.id and ur.role in ('admin', 'staff')
  left join public.profiles p on p.id = u.id;

  return result;
end;
$$;

create or replace function private.set_staff_member(p_email text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_role text := lower(trim(coalesce(p_role, '')));
  v_user_id uuid;
  v_current_role text;
begin
  if not coalesce(private.is_owner(), false) then
    raise exception using errcode = '42501', message = 'Owner role is required';
  end if;
  if v_email = '' or length(v_email) > 254 or position('@' in v_email) < 2 then
    raise exception using errcode = '22023', message = 'A valid employee email is required';
  end if;
  if v_role not in ('staff', 'customer') then
    raise exception using errcode = '22023', message = 'Only staff or customer roles can be assigned';
  end if;

  select u.id into v_user_id from auth.users u where lower(u.email) = v_email limit 1;
  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'Auth user was not found. Create the account in Supabase Auth first.';
  end if;

  select role into v_current_role from public.user_roles where user_id = v_user_id;
  if v_current_role = 'admin' and v_role <> 'admin' then
    raise exception using errcode = '42501', message = 'The owner role cannot be changed here';
  end if;

  insert into public.user_roles (user_id, role, granted_by)
  values (v_user_id, v_role, auth.uid())
  on conflict (user_id) do update set role = excluded.role, granted_by = excluded.granted_by;

  insert into public.admin_audit_logs (admin_user_id, action, resource_type, resource_id, changed_fields)
  values (auth.uid(), 'staff.role_update', 'user', v_user_id, array['role']::text[]);

  return jsonb_build_object('userId', v_user_id, 'email', v_email, 'role', v_role);
end;
$$;

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

revoke all on function private.list_backoffice_users() from public, anon, authenticated;
revoke all on function private.set_staff_member(text, text) from public, anon, authenticated;
revoke all on function public.list_backoffice_users() from public, anon;
revoke all on function public.set_staff_member(text, text) from public, anon;
grant execute on function private.list_backoffice_users() to service_role;
grant execute on function private.set_staff_member(text, text) to service_role;
grant execute on function public.list_backoffice_users() to authenticated;
grant execute on function public.set_staff_member(text, text) to authenticated;

