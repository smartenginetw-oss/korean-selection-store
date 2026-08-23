-- Allow authenticated back-office sessions to reach the store settings table.
-- RLS still limits rows and writes to the owner via private.is_owner().
grant select, update on table public.store_settings to authenticated;
