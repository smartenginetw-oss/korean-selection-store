-- Member-only wishlist. The composite key prevents duplicate saves and the
-- RLS policy keeps the list private to the signed-in member.

create table if not exists public.favorites (
  user_id uuid not null references auth.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create index if not exists favorites_product_idx on public.favorites(product_id, created_at desc);
alter table public.favorites enable row level security;

drop policy if exists "favorites own select" on public.favorites;
create policy "favorites own select" on public.favorites for select to authenticated
  using (user_id = auth.uid());
drop policy if exists "favorites own insert" on public.favorites;
create policy "favorites own insert" on public.favorites for insert to authenticated
  with check (user_id = auth.uid());
drop policy if exists "favorites own delete" on public.favorites;
create policy "favorites own delete" on public.favorites for delete to authenticated
  using (user_id = auth.uid());

revoke all on table public.favorites from anon;
grant select, insert, delete on table public.favorites to authenticated;
