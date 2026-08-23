-- Table privileges are separate from RLS policies. Visitors need SELECT so the
-- published-page policy can be evaluated; writes remain authenticated/admin-only.
grant select on table public.store_pages to anon, authenticated;
grant insert, update on table public.store_pages to authenticated;
revoke delete on table public.store_pages from anon, authenticated;

