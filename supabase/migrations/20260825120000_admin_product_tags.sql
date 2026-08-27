-- Allow catalog staff to manage merchandising tags without exposing cost data.
-- The primary category remains the first tag for backwards-compatible catalog mapping.

create or replace function private.update_admin_product_tags(p_product_id uuid, p_tags text[])
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_category_slug text;
  v_input text;
  v_tags text[] := array[]::text[];
begin
  if not coalesce(private.can_manage_catalog(), false) then
    raise exception using errcode = '42501', message = 'Catalog role is required';
  end if;

  if p_product_id is null then
    raise exception using errcode = '22023', message = 'Product id is required';
  end if;

  select c.slug into v_category_slug
  from public.product_categories pc
  join public.categories c on c.id = pc.category_id
  where pc.product_id = p_product_id and pc.is_primary = true
  limit 1;

  if v_category_slug is null then
    raise exception using errcode = 'P0002', message = 'Product category was not found';
  end if;

  if p_tags is not null and cardinality(p_tags) > 12 then
    raise exception using errcode = '22023', message = 'At most 12 product tags are allowed';
  end if;

  if p_tags is not null then
    foreach v_input in array p_tags loop
      v_input := lower(trim(coalesce(v_input, '')));
      if length(v_input) > 40 or v_input ~ '[\r\n]' then
        raise exception using errcode = '22023', message = 'Product tags must be at most 40 characters and single-line';
      end if;
      if v_input <> '' and v_input <> v_category_slug and not (v_input = any(v_tags)) then
        v_tags := array_append(v_tags, v_input);
      end if;
    end loop;
  end if;

  update public.products
  set tags = array_prepend(v_category_slug, v_tags), updated_at = now()
  where id = p_product_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'Product was not found';
  end if;

  insert into public.admin_audit_logs (admin_user_id, action, resource_type, resource_id, changed_fields)
  values (auth.uid(), 'product.tags.update', 'product', p_product_id, array['tags']::text[]);

  return jsonb_build_object('productId', p_product_id, 'tags', to_jsonb(array_prepend(v_category_slug, v_tags)));
end;
$$;

create or replace function public.update_admin_product_tags(p_product_id uuid, p_tags text[])
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.update_admin_product_tags(p_product_id, p_tags);
$$;

revoke all on function private.update_admin_product_tags(uuid, text[]) from public, anon, authenticated;
revoke all on function public.update_admin_product_tags(uuid, text[]) from public, anon;
grant execute on function public.update_admin_product_tags(uuid, text[]) to authenticated;
