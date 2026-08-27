-- Short-lived, atomic rate-limit counters for public checkout endpoints.
-- The table stays in the private schema and is reachable only through the
-- service-role-only wrapper used by the Edge Function.

create table if not exists private.api_rate_limits (
  rate_key text primary key check (char_length(rate_key) between 8 and 200),
  window_started_at timestamptz not null,
  hits integer not null default 0 check (hits >= 0 and hits <= 10000)
);

create or replace function private.consume_api_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_key text := nullif(trim(coalesce(p_rate_key, '')), '');
  v_now timestamptz := clock_timestamp();
  v_started_at timestamptz;
  v_hits integer;
  v_reset_seconds integer;
begin
  if v_key is null or char_length(v_key) > 200 then
    raise exception using errcode = '22023', message = 'Rate-limit key is invalid';
  end if;
  if p_limit is null or p_limit < 1 or p_limit > 1000 then
    raise exception using errcode = '22023', message = 'Rate-limit value is invalid';
  end if;
  if p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception using errcode = '22023', message = 'Rate-limit window is invalid';
  end if;

  insert into private.api_rate_limits (rate_key, window_started_at, hits)
  values (v_key, v_now, 1)
  on conflict (rate_key) do update
  set window_started_at = case
        when private.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= excluded.window_started_at
          then excluded.window_started_at
        else private.api_rate_limits.window_started_at
      end,
      hits = case
        when private.api_rate_limits.window_started_at + make_interval(secs => p_window_seconds) <= excluded.window_started_at
          then 1
        else least(10000, private.api_rate_limits.hits + 1)
      end
  returning window_started_at, hits into v_started_at, v_hits;

  -- Bound table growth without a scheduled job. A request cleans up at most
  -- 100 counters older than two hours, keeping this path predictable.
  with expired as (
    select rate_key
    from private.api_rate_limits
    where window_started_at < v_now - interval '2 hours'
    order by window_started_at
    limit 100
  )
  delete from private.api_rate_limits r
  using expired
  where r.rate_key = expired.rate_key;

  v_reset_seconds := greatest(1, p_window_seconds - floor(extract(epoch from (v_now - v_started_at)))::integer);
  return jsonb_build_object(
    'allowed', v_hits <= p_limit,
    'limit', p_limit,
    'remaining', greatest(0, p_limit - v_hits),
    'retryAfterSeconds', case when v_hits <= p_limit then 0 else v_reset_seconds end
  );
end;
$$;

create or replace function public.consume_api_rate_limit(
  p_rate_key text,
  p_limit integer,
  p_window_seconds integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.consume_api_rate_limit(p_rate_key, p_limit, p_window_seconds);
$$;

revoke all on table private.api_rate_limits from public, anon, authenticated;
revoke all on function private.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
revoke all on function public.consume_api_rate_limit(text, integer, integer) from public, anon, authenticated;
grant usage on schema private to service_role;
grant execute on function private.consume_api_rate_limit(text, integer, integer) to service_role;
grant execute on function public.consume_api_rate_limit(text, integer, integer) to service_role;
