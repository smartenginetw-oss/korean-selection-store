-- Keep the published customer-facing shipping copy aligned with the V1
-- delivery methods. This is intentionally idempotent so it can be applied to
-- local and remote projects without overwriting owner-edited copy.
update public.store_pages
set body = case slug
  when 'shopping-guide' then '目前支援台灣宅配、7-ELEVEN 與全家超商取貨，也提供現貨與預購商品。混合訂單會於商品全數到齊後一次寄出。'
  when 'shipping' then '目前提供台灣宅配、7-ELEVEN 與全家超商取貨。訂單成立後，我們會依庫存與預購到貨狀態安排出貨。'
  else body
end,
updated_at = now()
where slug in ('shopping-guide', 'shipping')
  and body in (
    'V1 支援台灣宅配、現貨與預購。混合訂單會於商品全數到齊後一次寄出。',
    '第一階段僅提供台灣宅配。訂單成立後，我們會依庫存與預購到貨狀態安排出貨。'
  );
