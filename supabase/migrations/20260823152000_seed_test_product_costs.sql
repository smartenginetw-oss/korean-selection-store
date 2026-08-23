-- Preview-only product costs for validating the income/expense report.
-- Only fill blank costs so later real purchase costs are never overwritten.
update public.products
set cost_price = case slug
  when 'half-moon-bag' then 520
  when 'daily-soft-shirt' then 430
  when 'soft-oversize-knit' then 360
  when 'calm-pleated-trousers' then 560
end,
updated_at = now()
where cost_price is null
  and slug in ('half-moon-bag', 'daily-soft-shirt', 'soft-oversize-knit', 'calm-pleated-trousers');
