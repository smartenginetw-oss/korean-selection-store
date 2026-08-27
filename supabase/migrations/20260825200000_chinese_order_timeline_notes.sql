-- Keep customer and staff-facing order timeline system notes in Traditional Chinese.
-- Staff-entered notes are intentionally left unchanged.

create or replace function private.normalize_order_timeline_note()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.note = 'Test payment adapter confirmed the order.' then
    new.note := '測試付款已確認訂單。';
  elsif new.note = 'Order shipped by admin.' then
    new.note := '後台已更新出貨資訊。';
  elsif new.note = 'Inventory reservation expired.' then
    new.note := '庫存保留已逾時。';
  elsif new.note ~ '^Inventory held for [0-9]+ minutes\.$' then
    new.note := pg_catalog.regexp_replace(new.note, '^Inventory held for ([0-9]+) minutes\.$', '庫存已保留 \1 分鐘。');
  end if;
  return new;
end;
$$;

revoke all on function private.normalize_order_timeline_note() from public, anon, authenticated, service_role;

drop trigger if exists normalize_order_timeline_note on public.order_timeline;
create trigger normalize_order_timeline_note
before insert or update of note on public.order_timeline
for each row execute function private.normalize_order_timeline_note();

update public.order_timeline
set note = case
  when note = 'Test payment adapter confirmed the order.' then '測試付款已確認訂單。'
  when note = 'Order shipped by admin.' then '後台已更新出貨資訊。'
  when note = 'Inventory reservation expired.' then '庫存保留已逾時。'
  when note ~ '^Inventory held for [0-9]+ minutes\.$'
    then pg_catalog.regexp_replace(note, '^Inventory held for ([0-9]+) minutes\.$', '庫存已保留 \1 分鐘。')
  else note
end
where note in (
  'Test payment adapter confirmed the order.',
  'Order shipped by admin.',
  'Inventory reservation expired.'
)
or note ~ '^Inventory held for [0-9]+ minutes\.$';
