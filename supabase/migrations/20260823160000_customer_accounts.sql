-- Customer account foundation.
-- New members receive a profile and a customer role without exposing any
-- role-changing capability to the browser. Guest orders can be read by the
-- verified account that owns the same email, while all other PII remains
-- protected by the existing RLS policies.

create or replace function public.handle_new_customer_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'display_name', '')), '')
  )
  on conflict (id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, 'customer')
  on conflict (user_id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_customer on auth.users;
create trigger on_auth_user_created_customer
  after insert on auth.users
  for each row execute function public.handle_new_customer_user();

drop policy if exists "orders own select" on public.orders;
create policy "orders own select" on public.orders for select to authenticated
  using (
    profile_id = auth.uid()
    or (
      profile_id is null
      and lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
    or private.can_manage_orders()
  );

drop policy if exists "order items own select" on public.order_items;
create policy "order items own select" on public.order_items for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.profile_id = auth.uid()
          or (
            o.profile_id is null
            and lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
          or private.can_manage_orders()
        )
    )
  );

drop policy if exists "payments own select" on public.payments;
create policy "payments own select" on public.payments for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.profile_id = auth.uid()
          or (
            o.profile_id is null
            and lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
          or private.can_manage_orders()
        )
    )
  );

drop policy if exists "shipments own select" on public.shipments;
create policy "shipments own select" on public.shipments for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.profile_id = auth.uid()
          or (
            o.profile_id is null
            and lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
          or private.can_manage_orders()
        )
    )
  );

drop policy if exists "timeline own select" on public.order_timeline;
create policy "timeline own select" on public.order_timeline for select to authenticated
  using (
    exists (
      select 1 from public.orders o
      where o.id = order_id
        and (
          o.profile_id = auth.uid()
          or (
            o.profile_id is null
            and lower(o.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
          )
          or private.can_manage_orders()
        )
    )
  );
