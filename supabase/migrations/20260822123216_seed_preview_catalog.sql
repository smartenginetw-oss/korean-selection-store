-- Preview catalog seed for the first Taiwan storefront slice.
-- This is intentionally idempotent: rerunning it updates the known slugs/SKUs
-- without deleting any admin-created catalog records.

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

insert into public.products (name, slug, description, original_price, sale_price, status, tags, published_at)
values
  ('柔霧 Oversize 針織上衣', 'soft-oversize-knit', '選用柔軟細緻的針織面料，帶有恰好的寬鬆輪廓。單穿或作為秋冬層次都自然耐看。', 1080, 890, 'active', array['new'], now()),
  ('日常柔光落肩襯衫', 'daily-soft-shirt', '俐落但不緊繃的落肩版型，適合日常通勤與週末穿搭。', null, 1080, 'active', array['new'], now()),
  ('半月柔革肩背包', 'half-moon-bag', '輕巧弧形包身與霧面質感，容量足以收納每日隨身用品。', null, 1290, 'active', array[]::text[], now()),
  ('靜謐細褶寬褲', 'calm-pleated-trousers', '垂墜細褶隨步伐自然展開，鬆緊腰頭讓日常穿著更自在。', null, 1180, 'active', array[]::text[], now())
on conflict (slug) do update
set name = excluded.name,
    description = excluded.description,
    original_price = excluded.original_price,
    sale_price = excluded.sale_price,
    status = excluded.status,
    tags = excluded.tags,
    published_at = excluded.published_at;

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

insert into public.product_options (product_id, name, position)
select p.id, seed.option_name, seed.position
from (values
  ('soft-oversize-knit', '顏色', 1), ('soft-oversize-knit', '尺寸', 2),
  ('daily-soft-shirt', '顏色', 1), ('daily-soft-shirt', '尺寸', 2),
  ('half-moon-bag', '顏色', 1), ('half-moon-bag', '尺寸', 2),
  ('calm-pleated-trousers', '顏色', 1), ('calm-pleated-trousers', '尺寸', 2)
) as seed(product_slug, option_name, position)
join public.products p on p.slug = seed.product_slug
on conflict (product_id, name) do update set position = excluded.position;

insert into public.product_option_values (option_id, value, position)
select po.id, seed.option_value, seed.position
from (values
  ('soft-oversize-knit', '顏色', '奶茶', 1), ('soft-oversize-knit', '顏色', '灰色', 2),
  ('soft-oversize-knit', '尺寸', 'S', 1), ('soft-oversize-knit', '尺寸', 'M', 2), ('soft-oversize-knit', '尺寸', 'L', 3),
  ('daily-soft-shirt', '顏色', '暖白', 1), ('daily-soft-shirt', '顏色', '鼠尾草', 2),
  ('daily-soft-shirt', '尺寸', 'Free', 1),
  ('half-moon-bag', '顏色', '燕麥', 1), ('half-moon-bag', '顏色', '深棕', 2),
  ('half-moon-bag', '尺寸', 'Free', 1),
  ('calm-pleated-trousers', '顏色', '暖灰', 1), ('calm-pleated-trousers', '顏色', '霧黑', 2),
  ('calm-pleated-trousers', '尺寸', 'S', 1), ('calm-pleated-trousers', '尺寸', 'M', 2)
) as seed(product_slug, option_name, option_value, position)
join public.products p on p.slug = seed.product_slug
join public.product_options po on po.product_id = p.id and po.name = seed.option_name
on conflict (option_id, value) do update set position = excluded.position;

do $$
declare
  seed record;
  selected record;
  v_product_id uuid;
  v_variant_id uuid;
  v_option_id uuid;
  v_option_value_id uuid;
begin
  for seed in
    select * from (values
      ('soft-oversize-knit', 'KNIT-MILK-S', '奶茶', 'S', 'in_stock', null::date, 3),
      ('soft-oversize-knit', 'KNIT-MILK-M', '奶茶', 'M', 'in_stock', null::date, 3),
      ('soft-oversize-knit', 'KNIT-MILK-L', '奶茶', 'L', 'in_stock', null::date, 3),
      ('soft-oversize-knit', 'KNIT-GREY-S', '灰色', 'S', 'in_stock', null::date, 3),
      ('soft-oversize-knit', 'KNIT-GREY-M', '灰色', 'M', 'in_stock', null::date, 3),
      ('soft-oversize-knit', 'KNIT-GREY-L', '灰色', 'L', 'in_stock', null::date, 3),
      ('daily-soft-shirt', 'SHIRT-IVORY-F', '暖白', 'Free', 'in_stock', null::date, 3),
      ('daily-soft-shirt', 'SHIRT-SAGE-F', '鼠尾草', 'Free', 'in_stock', null::date, 3),
      ('half-moon-bag', 'BAG-OAT-F', '燕麥', 'Free', 'preorder', '2026-09-25'::date, 20),
      ('half-moon-bag', 'BAG-BROWN-F', '深棕', 'Free', 'preorder', '2026-09-25'::date, 20),
      ('calm-pleated-trousers', 'TROUSERS-GREY-S', '暖灰', 'S', 'in_stock', null::date, 3),
      ('calm-pleated-trousers', 'TROUSERS-GREY-M', '暖灰', 'M', 'in_stock', null::date, 3),
      ('calm-pleated-trousers', 'TROUSERS-BLACK-S', '霧黑', 'S', 'in_stock', null::date, 3),
      ('calm-pleated-trousers', 'TROUSERS-BLACK-M', '霧黑', 'M', 'in_stock', null::date, 3)
    ) as variants(product_slug, sku, color_value, size_value, fulfillment_mode, preorder_available_at, on_hand)
  loop
    select id into v_product_id from public.products where slug = seed.product_slug;

    insert into public.product_variants (product_id, sku, status, fulfillment_mode, preorder_available_at)
    values (v_product_id, seed.sku, 'active', seed.fulfillment_mode, seed.preorder_available_at)
    on conflict do nothing;

    select id into v_variant_id from public.product_variants where sku = seed.sku;
    update public.product_variants
    set product_id = v_product_id,
        status = 'active',
        fulfillment_mode = seed.fulfillment_mode,
        preorder_available_at = seed.preorder_available_at
    where id = v_variant_id;

    for selected in
      select * from (values ('顏色', seed.color_value), ('尺寸', seed.size_value)) as picked(option_name, option_value)
    loop
      select po.id into v_option_id
      from public.product_options po
      where po.product_id = v_product_id and po.name = selected.option_name;

      select pov.id into v_option_value_id
      from public.product_option_values pov
      where pov.option_id = v_option_id and pov.value = selected.option_value;

      insert into public.variant_option_values (variant_id, option_value_id)
      values (v_variant_id, v_option_value_id)
      on conflict do nothing;
    end loop;

    insert into public.inventory_levels (variant_id, on_hand, reserved, low_stock_threshold)
    values (v_variant_id, seed.on_hand, 0, 3)
    on conflict (variant_id) do update
    set on_hand = excluded.on_hand,
        reserved = least(public.inventory_levels.reserved, excluded.on_hand);
  end loop;
end;
$$;
