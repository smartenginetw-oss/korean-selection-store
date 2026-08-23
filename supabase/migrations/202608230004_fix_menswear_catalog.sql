-- Correct the preview trousers SKUs that still carried the old skirt prefix.
-- Keep the variant rows and inventory quantities intact; only the human-facing
-- SKU identifier is corrected to match the published menswear product.
update public.product_variants pv
set sku = replace(pv.sku, 'SKIRT-', 'TROUSERS-')
from public.products p
where pv.product_id = p.id
  and p.slug = 'calm-pleated-trousers'
  and pv.sku like 'SKIRT-%';

-- These legacy categories remain archived rather than deleted so historical
-- references can continue to resolve safely.
update public.categories
set is_active = false
where slug in ('women', 'lifestyle');
