-- Supplier quotations are private back-office records.
revoke all on table public.supplier_quotations, public.supplier_quotation_items from anon;
revoke all on table public.supplier_quotations, public.supplier_quotation_items from authenticated;
grant select, insert, update, delete on table public.supplier_quotations, public.supplier_quotation_items to authenticated;
