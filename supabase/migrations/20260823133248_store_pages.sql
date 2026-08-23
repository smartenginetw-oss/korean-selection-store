-- Public brand/service pages managed by the owner or approved staff.
-- Only published rows are readable to shoppers; drafts stay behind the admin RLS boundary.

create table if not exists public.store_pages (
  slug text primary key check (slug in ('about', 'shopping-guide', 'shipping', 'returns', 'contact', 'privacy', 'terms')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null check (char_length(body) between 1 and 12000),
  is_published boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.store_pages (slug, title, body, is_published)
values
  ('about', '關於 GYEOT', 'GYEOT（곁）是韓文「身邊、陪伴」的意思。我們從版型、觸感與日常搭配出發，挑選能陪你反覆穿著的韓國男裝。', true),
  ('shopping-guide', '購物說明', 'V1 支援台灣宅配、現貨與預購。混合訂單會於商品全數到齊後一次寄出。', true),
  ('shipping', '配送政策', '第一階段僅提供台灣宅配。訂單成立後，我們會依庫存與預購到貨狀態安排出貨。', true),
  ('returns', '退換貨政策', '此頁目前是路由骨架；正式文字必須經台灣法務確認後才能上線。', false),
  ('contact', '聯絡我們', '如有商品、訂單或配送問題，歡迎透過客服 Email 聯繫我們。', true),
  ('privacy', '隱私權政策', '此頁目前是路由骨架。正式版本將載明蒐集目的、資料類別、利用期間、第三方服務、跨境傳輸與當事人權利。', false),
  ('terms', '服務條款', '此頁目前是路由骨架；正式文字必須經法務審閱。', false)
on conflict (slug) do nothing;

alter table public.store_pages enable row level security;
drop policy if exists store_pages_public_select on public.store_pages;
drop policy if exists store_pages_admin_select on public.store_pages;
drop policy if exists store_pages_admin_insert on public.store_pages;
drop policy if exists store_pages_admin_update on public.store_pages;
create policy store_pages_public_select on public.store_pages
  for select to anon, authenticated using (is_published = true);
create policy store_pages_admin_select on public.store_pages
  for select to authenticated using (private.is_admin());
create policy store_pages_admin_insert on public.store_pages
  for insert to authenticated with check (private.is_admin());
create policy store_pages_admin_update on public.store_pages
  for update to authenticated using (private.is_admin()) with check (private.is_admin());

create index if not exists store_pages_published_idx on public.store_pages(slug) where is_published = true;

