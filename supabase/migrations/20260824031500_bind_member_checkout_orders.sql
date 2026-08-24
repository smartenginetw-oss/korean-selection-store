-- Bind authenticated checkout orders to the verified member profile.
-- The existing two-argument checkout function remains available for guests;
-- this wrapper attaches the profile in the same transaction and protects
-- idempotent replays from being claimed by another member.

create or replace function private.create_checkout_order_for_member(
  p_payload jsonb,
  p_idempotency_key text,
  p_profile_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  result jsonb;
  order_id uuid;
  existing_profile_id uuid;
begin
  if p_profile_id is not null and not exists (
    select 1 from auth.users where id = p_profile_id
  ) then
    raise exception using errcode = '42501', message = 'Member account was not found';
  end if;

  result := private.create_checkout_order(p_payload, p_idempotency_key);
  order_id := nullif(result ->> 'orderId', '')::uuid;

  if p_profile_id is not null and order_id is not null then
    select o.profile_id into existing_profile_id
    from public.orders o
    where o.id = order_id
    for update;

    if existing_profile_id is not null and existing_profile_id <> p_profile_id then
      raise exception using errcode = '42501', message = 'This idempotent order belongs to another member';
    end if;

    if existing_profile_id is null then
      update public.orders
      set profile_id = p_profile_id, updated_at = now()
      where id = order_id and profile_id is null;
    end if;
  end if;

  return result;
end;
$$;

create or replace function public.create_checkout_order_for_member(
  p_payload jsonb,
  p_idempotency_key text,
  p_profile_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.create_checkout_order_for_member(p_payload, p_idempotency_key, p_profile_id);
$$;

revoke all on function private.create_checkout_order_for_member(jsonb, text, uuid) from public, anon, authenticated;
revoke all on function public.create_checkout_order_for_member(jsonb, text, uuid) from public, anon, authenticated;
grant execute on function private.create_checkout_order_for_member(jsonb, text, uuid) to service_role;
grant execute on function public.create_checkout_order_for_member(jsonb, text, uuid) to service_role;
