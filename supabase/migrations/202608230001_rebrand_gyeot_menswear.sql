-- Align the preview catalog with the GYEOT Korean menswear storefront.
-- This migration keeps product and order relationships intact while moving
-- the preview products to menswear categories.

insert into public.categories (name, slug, description, sort_order, is_active)
values
  ('上衣', 'tops', '針織、襯衫與日常上衣。', 1, true),
  ('下著', 'bottoms', '適合日常穿著的韓系男裝下著。', 2, true),
  ('外套與層次', 'outerwear', '為日常輪廓增加層次的外套。', 3, true),
  ('配件與包款', 'accessories', '輕巧、耐看的日常配件。', 4, true)
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    sort_order = excluded.sort_order,
    is_active = excluded.is_active;

update public.categories
set is_active = false
where slug in ('women', 'lifestyle');

update public.products
set slug = 'calm-pleated-trousers',
    name = '靜謐細褶寬褲',
    description = '垂墜細褶隨步伐自然展開，鬆緊腰頭讓日常穿著更自在。'
where slug = 'calm-pleated-skirt';

delete from public.product_categories pc
using public.products p, public.categories c
where pc.product_id = p.id
  and pc.category_id = c.id
  and p.slug in ('soft-oversize-knit', 'daily-soft-shirt', 'half-moon-bag', 'calm-pleated-trousers')
  and c.slug in ('women', 'lifestyle', 'tops', 'bottoms', 'outerwear', 'accessories');

insert into public.product_categories (product_id, category_id, is_primary)
select p.id, c.id, true
from (values
  ('soft-oversize-knit', 'tops'),
  ('daily-soft-shirt', 'tops'),
  ('calm-pleated-trousers', 'bottoms'),
  ('half-moon-bag', 'accessories')
) as seed(product_slug, category_slug)
join public.products p on p.slug = seed.product_slug
join public.categories c on c.slug = seed.category_slug
on conflict (product_id, category_id) do update set is_primary = excluded.is_primary;
