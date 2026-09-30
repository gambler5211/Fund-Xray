-- Week 3, Day 4: the latest price indicators per stock and per index.
--
-- latest_indicators  one row per stock (kind 'stock', key = NSE symbol) or tracked index (kind
--                    'index', key = tracked_indices.key): the date of the last close used and
--                    RSI(14), Wilder's version. Rewritten by jobs/compute_indicators.py each night.
--                    Week 4 adds the 200-day trend here.
-- Market data, not personal: every signed-in user can read it; only jobs write it.

create table if not exists public.latest_indicators (
  kind   text not null check (kind in ('stock', 'index')),
  key    text not null,
  date   date not null,
  rsi14  numeric,
  primary key (kind, key)
);

alter table public.latest_indicators enable row level security;
revoke all on public.latest_indicators from anon;
revoke all on public.latest_indicators from authenticated;
grant select on public.latest_indicators to authenticated;

drop policy if exists "latest_indicators: signed-in read" on public.latest_indicators;
create policy "latest_indicators: signed-in read" on public.latest_indicators for select to authenticated using (true);
