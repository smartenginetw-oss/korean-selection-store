-- Public delivery bucket for storefront product images. Writes remain
-- restricted to admin users through storage.objects RLS policies.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-images',
  'product-images',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create unique index if not exists product_images_storage_path_uq
  on public.product_images(storage_path);

drop policy if exists "admin product image upload" on storage.objects;
create policy "admin product image upload"
on storage.objects
for insert to authenticated
with check (
  bucket_id = 'product-images'
  and name like 'products/%'
  and lower(name) ~ '\.(jpg|jpeg|png|webp|avif)$'
  and private.is_admin()
);

drop policy if exists "admin product image update" on storage.objects;
create policy "admin product image update"
on storage.objects
for update to authenticated
using (
  bucket_id = 'product-images'
  and name like 'products/%'
  and private.is_admin()
)
with check (
  bucket_id = 'product-images'
  and name like 'products/%'
  and lower(name) ~ '\.(jpg|jpeg|png|webp|avif)$'
  and private.is_admin()
);

drop policy if exists "admin product image delete" on storage.objects;
create policy "admin product image delete"
on storage.objects
for delete to authenticated
using (
  bucket_id = 'product-images'
  and name like 'products/%'
  and private.is_admin()
);
