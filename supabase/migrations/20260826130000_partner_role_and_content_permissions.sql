-- Partner access for shared brand and content operations.
-- Partners have the same operational back-office visibility as staff, but
-- only owners and partners may edit, save, publish, or preview content.

alter table public.user_roles drop constraint if exists user_roles_role_check;
alter table public.user_roles add constraint user_roles_role_check
  check (role in ('customer', 'partner', 'staff', 'catalog_staff', 'order_staff', 'admin'));

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'partner', 'staff', 'catalog_staff', 'order_staff')
  );
$$;

create or replace function private.can_manage_catalog()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'partner', 'staff', 'catalog_staff')
  );
$$;

create or replace function private.can_manage_orders()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'partner', 'staff', 'order_staff')
  );
$$;

create or replace function private.can_manage_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'partner')
  );
$$;

create or replace function private.can_view_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'partner', 'staff')
  );
$$;

create or replace function private.can_view_reports()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = auth.uid() and role in ('admin', 'partner', 'staff', 'order_staff')
  );
$$;

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
  join public.user_roles ur on ur.user_id = u.id
    and ur.role in ('admin', 'partner', 'staff', 'catalog_staff', 'order_staff')
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
    raise exception using errcode = '22023', message = 'A valid team member email is required';
  end if;
  if v_role not in ('partner', 'staff', 'catalog_staff', 'order_staff', 'customer') then
    raise exception using errcode = '22023', message = 'Team member role is invalid';
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

drop policy if exists store_pages_admin_select on public.store_pages;
drop policy if exists store_pages_admin_insert on public.store_pages;
drop policy if exists store_pages_admin_update on public.store_pages;
create policy store_pages_admin_select on public.store_pages
  for select to authenticated using (private.can_view_content());
create policy store_pages_admin_insert on public.store_pages
  for insert to authenticated with check (private.can_manage_content());
create policy store_pages_admin_update on public.store_pages
  for update to authenticated using (private.can_manage_content()) with check (private.can_manage_content());

drop policy if exists store_home_collections_content_select on public.store_home_collections;
drop policy if exists store_home_collections_content_insert on public.store_home_collections;
drop policy if exists store_home_collections_content_update on public.store_home_collections;
drop policy if exists store_home_collections_content_delete on public.store_home_collections;
create policy store_home_collections_content_select on public.store_home_collections
  for select to authenticated using (private.can_view_content());
create policy store_home_collections_content_insert on public.store_home_collections
  for insert to authenticated with check (private.can_manage_content());
create policy store_home_collections_content_update on public.store_home_collections
  for update to authenticated using (private.can_manage_content()) with check (private.can_manage_content());
create policy store_home_collections_content_delete on public.store_home_collections
  for delete to authenticated using (private.can_manage_content());
