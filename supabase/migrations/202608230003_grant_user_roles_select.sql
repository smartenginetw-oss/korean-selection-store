-- The roles table is RLS-protected, but authenticated users still need the
-- table-level SELECT grant for the admin authorization check to run.
grant select on table public.user_roles to authenticated;
