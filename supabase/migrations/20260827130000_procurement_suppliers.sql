-- V1.5 procurement foundation: supplier directory.
-- Supplier contacts and commercial terms are back-office data; they are never
-- exposed to the public catalogue or customer roles.

create table if not exists public.suppliers (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 160),
  country text not null default '韓國' check (char_length(country) between 1 and 80),
  contact_name text check (contact_name is null or char_length(contact_name) <= 80),
  phone text check (phone is null or char_length(phone) <= 40),
  email text check (email is null or char_length(email) <= 254),
  line text check (line is null or char_length(line) <= 80),
  kakao text check (kakao is null or char_length(kakao) <= 80),
  payment_terms text check (payment_terms is null or char_length(payment_terms) <= 240),
  note text check (note is null or char_length(note) <= 2000),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists suppliers_name_lower_uq on public.suppliers(lower(name));
create index if not exists suppliers_active_name_idx on public.suppliers(is_active, name);

drop trigger if exists suppliers_updated_at on public.suppliers;
create trigger suppliers_updated_at before update on public.suppliers
for each row execute function public.set_updated_at();

alter table public.suppliers enable row level security;

create or replace function private.is_procurement_manager()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles
    where user_id = auth.uid()
      and role in ('admin', 'partner', 'staff')
  );
$$;

revoke all on function private.is_procurement_manager() from public, anon, authenticated;
grant execute on function private.is_procurement_manager() to authenticated;

drop policy if exists suppliers_backoffice_select on public.suppliers;
drop policy if exists suppliers_backoffice_insert on public.suppliers;
drop policy if exists suppliers_backoffice_update on public.suppliers;

create policy suppliers_backoffice_select on public.suppliers
  for select to authenticated
  using (private.is_procurement_manager());

create policy suppliers_backoffice_insert on public.suppliers
  for insert to authenticated
  with check (private.is_procurement_manager());

create policy suppliers_backoffice_update on public.suppliers
  for update to authenticated
  using (private.is_procurement_manager())
  with check (private.is_procurement_manager());
