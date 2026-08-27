-- RLS policies decide which rows owner/staff can access, while the Data API
-- still needs table privileges before it evaluates those policies.
grant select, insert, update, delete on table public.operating_expenses to authenticated;
