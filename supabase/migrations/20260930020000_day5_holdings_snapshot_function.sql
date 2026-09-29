-- Day 5: the API saves your holdings snapshot through this function, as you (auth.uid()).
--
-- One snapshot per day (India time) is kept: refreshing again the same day replaces that day's
-- snapshot, so history stays one row per day for later week-on-week comparisons.

create or replace function public.save_holdings_snapshot(p_holdings jsonb, p_positions jsonb, p_totals jsonb)
returns table (id bigint, taken_at timestamptz)
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not signed in';
  end if;
  if jsonb_typeof(p_holdings) <> 'array' or jsonb_typeof(p_positions) <> 'array' or jsonb_typeof(p_totals) <> 'object' then
    raise exception 'bad snapshot shape';
  end if;

  delete from public.holdings_snapshot s
  where s.user_id = uid
    and (s.taken_at at time zone 'Asia/Kolkata')::date = (now() at time zone 'Asia/Kolkata')::date;

  return query
  insert into public.holdings_snapshot as s (user_id, holdings, positions, totals)
  values (uid, p_holdings, p_positions, p_totals)
  returning s.id, s.taken_at;
end $$;

revoke all on function public.save_holdings_snapshot(jsonb, jsonb, jsonb) from public, anon;
grant execute on function public.save_holdings_snapshot(jsonb, jsonb, jsonb) to authenticated;
