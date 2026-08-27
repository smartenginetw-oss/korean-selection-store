-- Backoffice needs to read immutable receipt history; writes remain RPC-only.
grant select on table public.purchase_order_receipts to authenticated;
grant select on table public.purchase_order_receipt_items to authenticated;
