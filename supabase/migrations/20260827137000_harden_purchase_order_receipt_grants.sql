-- Receipt batches are immutable; write access goes through the atomic RPC only.
revoke all on table public.purchase_order_receipts from anon, authenticated;
revoke all on table public.purchase_order_receipt_items from anon, authenticated;
revoke all on function public.receive_purchase_order(uuid, text, date, text, jsonb) from public, anon, authenticated;
grant execute on function public.receive_purchase_order(uuid, text, date, text, jsonb) to authenticated;
