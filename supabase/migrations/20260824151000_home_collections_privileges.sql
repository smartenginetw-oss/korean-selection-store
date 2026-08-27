-- The project hardens new tables by default. Grant only the API operations
-- required by the published storefront and content capability.
grant select on table public.store_home_collections to anon, authenticated;
grant insert, update, delete on table public.store_home_collections to authenticated;
