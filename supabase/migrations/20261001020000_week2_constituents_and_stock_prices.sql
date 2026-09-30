-- Week 2, Day 3: which stocks make up each tracked index, and their daily prices.
-- Breadth (how many of an index's stocks are rising) and the equal-weight comparison need them.
-- Shared reference data: signed-in users read, only the GitHub Actions jobs write.

-- Where each index's constituent list is published. Most are on NSE's archive; five newer
-- sector indices are only on niftyindices.com (same CSV format).
alter table public.tracked_indices add column if not exists constituents_url text;

update public.tracked_indices t set constituents_url = u.url
from (values
  ('nifty-50',                'https://nsearchives.nseindia.com/content/indices/ind_nifty50list.csv'),
  ('nifty-500',               'https://nsearchives.nseindia.com/content/indices/ind_nifty500list.csv'),
  ('nifty-midcap-150',        'https://nsearchives.nseindia.com/content/indices/ind_niftymidcap150list.csv'),
  ('nifty-smallcap-250',      'https://nsearchives.nseindia.com/content/indices/ind_niftysmallcap250list.csv'),
  ('nifty-microcap-250',      'https://nsearchives.nseindia.com/content/indices/ind_niftymicrocap250_list.csv'),
  ('nifty-bank',              'https://nsearchives.nseindia.com/content/indices/ind_niftybanklist.csv'),
  ('nifty-psu-bank',          'https://nsearchives.nseindia.com/content/indices/ind_niftypsubanklist.csv'),
  ('nifty-fin-services',      'https://nsearchives.nseindia.com/content/indices/ind_niftyfinancelist.csv'),
  ('nifty-it',                'https://nsearchives.nseindia.com/content/indices/ind_niftyitlist.csv'),
  ('nifty-pharma',            'https://nsearchives.nseindia.com/content/indices/ind_niftypharmalist.csv'),
  ('nifty-healthcare',        'https://nsearchives.nseindia.com/content/indices/ind_niftyhealthcarelist.csv'),
  ('nifty-fmcg',              'https://nsearchives.nseindia.com/content/indices/ind_niftyfmcglist.csv'),
  ('nifty-auto',              'https://nsearchives.nseindia.com/content/indices/ind_niftyautolist.csv'),
  ('nifty-metal',             'https://nsearchives.nseindia.com/content/indices/ind_niftymetallist.csv'),
  ('nifty-energy',            'https://nsearchives.nseindia.com/content/indices/ind_niftyenergylist.csv'),
  ('nifty-oil-gas',           'https://nsearchives.nseindia.com/content/indices/ind_niftyoilgaslist.csv'),
  ('nifty-realty',            'https://nsearchives.nseindia.com/content/indices/ind_niftyrealtylist.csv'),
  ('nifty-media',             'https://nsearchives.nseindia.com/content/indices/ind_niftymedialist.csv'),
  ('nifty-cons-durables',     'https://nsearchives.nseindia.com/content/indices/ind_niftyconsumerdurableslist.csv'),
  ('nifty-infra',             'https://nsearchives.nseindia.com/content/indices/ind_niftyinfralist.csv'),
  ('nifty-cpse',              'https://nsearchives.nseindia.com/content/indices/ind_niftycpselist.csv'),
  ('nifty-pse',               'https://nsearchives.nseindia.com/content/indices/ind_niftypselist.csv'),
  ('nifty-commodities',       'https://nsearchives.nseindia.com/content/indices/ind_niftycommoditieslist.csv'),
  ('nifty-defence',           'https://nsearchives.nseindia.com/content/indices/ind_niftyindiadefence_list.csv'),
  ('nifty-manufacturing',     'https://nsearchives.nseindia.com/content/indices/ind_niftyindiamanufacturing_list.csv'),
  ('nifty-services',          'https://nsearchives.nseindia.com/content/indices/ind_niftyservicelist.csv'),
  ('nifty-capital-markets',   'https://nsearchives.nseindia.com/content/indices/ind_niftyCapitalMarkets_list.csv'),
  ('nifty-capital-goods',     'https://www.niftyindices.com/IndexConstituent/ind_niftyCapitalGoods_list.csv'),
  ('nifty-power',             'https://www.niftyindices.com/IndexConstituent/ind_niftyPower_list.csv'),
  ('nifty-chemicals',         'https://www.niftyindices.com/IndexConstituent/ind_niftyChemicals_list.csv'),
  ('nifty-telecom',           'https://www.niftyindices.com/IndexConstituent/ind_niftyTelecommunications_list.csv'),
  ('nifty-consumer-services', 'https://www.niftyindices.com/IndexConstituent/ind_niftyConsumerServices_list.csv')
) as u(key, url)
where t.key = u.key;

create table if not exists public.index_constituents (
  index_key     text not null references public.tracked_indices (key) on delete cascade,
  isin          text not null,
  symbol        text not null,
  company_name  text,
  industry      text,
  updated_at    timestamptz not null default now(),
  primary key (index_key, isin)
);
create index if not exists index_constituents_symbol on public.index_constituents (symbol);

-- Daily closes from NSE's bhavcopy, for index constituents only. Keyed by symbol, because the
-- bhavcopy has no ISIN. Closes are as traded (not adjusted); prev_close is NSE's, which is
-- adjusted on a split or bonus ex-date, so the engine can adjust history when it needs to.
create table if not exists public.stock_prices (
  symbol      text not null,
  date        date not null,
  series      text not null,
  prev_close  numeric,
  close       numeric not null,
  volume      bigint,
  primary key (symbol, date)
);
create index if not exists stock_prices_date on public.stock_prices (date);

alter table public.index_constituents enable row level security;
alter table public.stock_prices       enable row level security;
revoke all on public.index_constituents, public.stock_prices from anon;
revoke all on public.index_constituents, public.stock_prices from authenticated;
grant select on public.index_constituents, public.stock_prices to authenticated;

drop policy if exists "index_constituents: signed-in read" on public.index_constituents;
drop policy if exists "stock_prices: signed-in read"       on public.stock_prices;
create policy "index_constituents: signed-in read" on public.index_constituents for select to authenticated using (true);
create policy "stock_prices: signed-in read"       on public.stock_prices       for select to authenticated using (true);
