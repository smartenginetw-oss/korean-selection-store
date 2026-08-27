-- Editable homepage collection links for the owner/content team.
-- The storefront only exposes published rows; internal routes are constrained
-- so a content edit cannot turn a homepage card into an external redirect.

create table if not exists public.store_home_collections (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug in ('new-arrivals', 'in-stock', 'preorder')),
  eyebrow text not null check (char_length(eyebrow) between 1 and 40),
  title text not null check (char_length(title) between 1 and 80),
  description text not null check (char_length(description) between 1 and 180),
  href text not null check (href ~ '^/[A-Za-z0-9/_?=&.%:#-]+$' and href !~ '^//'),
  tone text not null check (tone ~* '^#[0-9a-f]{6}$'),
  sort_order integer not null default 0 check (sort_order between 0 and 99),
  is_published boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.store_home_collections (slug, eyebrow, title, description, href, tone, sort_order)
values
  ('new-arrivals', 'JUST ARRIVED', '本週新品', '剛加入衣櫥的韓國男裝。', '/products?sort=newest', '#d8c6b5', 10),
  ('in-stock', 'READY TO SHIP', '現貨專區', '選好就能出發的日常單品。', '/products?availability=in_stock', '#b9b9aa', 20),
  ('preorder', 'TAKE YOUR TIME', '預購專區', '慢慢等，也值得的款式。', '/products?availability=preorder', '#c7ada7', 30)
on conflict (slug) do nothing;

create or replace function public.set_store_home_collections_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists store_home_collections_updated_at on public.store_home_collections;
create trigger store_home_collections_updated_at
before update on public.store_home_collections
for each row execute function public.set_store_home_collections_updated_at();

alter table public.store_home_collections enable row level security;
drop policy if exists store_home_collections_public_select on public.store_home_collections;
drop policy if exists store_home_collections_content_select on public.store_home_collections;
drop policy if exists store_home_collections_content_insert on public.store_home_collections;
drop policy if exists store_home_collections_content_update on public.store_home_collections;
drop policy if exists store_home_collections_content_delete on public.store_home_collections;

create policy store_home_collections_public_select on public.store_home_collections
  for select to anon, authenticated using (is_published = true);
create policy store_home_collections_content_select on public.store_home_collections
  for select to authenticated using (private.can_manage_content());
create policy store_home_collections_content_insert on public.store_home_collections
  for insert to authenticated with check (private.can_manage_content());
create policy store_home_collections_content_update on public.store_home_collections
  for update to authenticated using (private.can_manage_content()) with check (private.can_manage_content());
create policy store_home_collections_content_delete on public.store_home_collections
  for delete to authenticated using (private.can_manage_content());

create index if not exists store_home_collections_published_sort_idx
  on public.store_home_collections (sort_order)
  where is_published = true;
