-- Keep supplier data private to authenticated backoffice users.
-- RLS remains the final authorization boundary; these grants make the
-- intended Data API surface explicit and prevent anonymous table access.
revoke all on table public.suppliers from anon;
revoke all on table public.suppliers from authenticated;
grant select, insert, update on table public.suppliers to authenticated;
