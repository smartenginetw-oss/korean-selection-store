-- The store is menswear-first. Remove the unused women category now that it
-- has no product or child-category references; keep lifestyle archived.
delete from public.categories c
where c.slug = 'women'
  and not exists (
    select 1
    from public.product_categories pc
    where pc.category_id = c.id
  )
  and not exists (
    select 1
    from public.categories child
    where child.parent_id = c.id
  );
