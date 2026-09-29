-- Day 6: sectors for holdings, and daily index history.
--
-- Reference data (industry_map, tracked_indices, index_prices) is the same for everyone: signed-in
-- users can read it, and only the GitHub Actions jobs (with the Supabase secret key, which
-- bypasses row-level security) write it. sector_overrides is per user.

-- NSE's industry classification (sector level) by ISIN, from NSE's index constituent files.
create table if not exists public.industry_map (
  isin          text primary key,
  symbol        text not null,
  company_name  text,
  industry      text not null,
  source        text not null default 'nse',      -- which list it came from
  updated_at    timestamptz not null default now()
);
create index if not exists industry_map_symbol on public.industry_map (symbol);

-- Your own sector for a stock NSE hasn't classified (SME, newly listed). Keyed by exchange:symbol.
create table if not exists public.sector_overrides (
  user_id     uuid not null references public.users (id) on delete cascade,
  instrument  text not null,                        -- e.g. 'NSE:KRNHEAT'
  industry    text not null check (industry in ('Automobile and Auto Components', 'Capital Goods', 'Chemicals', 'Construction', 'Construction Materials', 'Consumer Durables', 'Consumer Services', 'Diversified', 'Fast Moving Consumer Goods', 'Financial Services', 'Forest Materials', 'Healthcare', 'Information Technology', 'Media Entertainment & Publication', 'Metals & Mining', 'Oil Gas & Consumable Fuels', 'Power', 'Realty', 'Services', 'Telecommunication', 'Textiles', 'Utilities')),
  updated_at  timestamptz not null default now(),
  primary key (user_id, instrument)
);

-- The indices we keep history for. nse_name matches the "Index Name" in NSE's daily file.
create table if not exists public.tracked_indices (
  key       text primary key,                       -- stable id, e.g. 'nifty-it'
  nse_name  text not null unique,
  label     text not null,
  kind      text not null check (kind in ('broad', 'sector', 'thematic')),
  sort      int not null default 100
);

create table if not exists public.index_prices (
  index_key  text not null references public.tracked_indices (key) on delete cascade,
  date       date not null,
  open       numeric, high numeric, low numeric,
  close      numeric not null,
  pe         numeric, pb numeric, div_yield numeric,
  primary key (index_key, date)
);

insert into public.tracked_indices (key, nse_name, label, kind, sort) values
  ('nifty-50',            'Nifty 50',                 'Nifty 50',              'broad',    1),
  ('nifty-500',           'Nifty 500',                'Nifty 500',             'broad',    2),
  ('nifty-midcap-150',    'Nifty Midcap 150',         'Midcap 150',            'broad',    3),
  ('nifty-smallcap-250',  'Nifty Smallcap 250',       'Smallcap 250',          'broad',    4),
  ('nifty-microcap-250',  'Nifty Microcap 250',       'Microcap 250',          'broad',    5),
  ('nifty-bank',          'Nifty Bank',               'Bank',                  'sector',  10),
  ('nifty-psu-bank',      'Nifty PSU Bank',           'PSU Bank',              'sector',  11),
  ('nifty-fin-services',  'Nifty Financial Services', 'Financial Services',    'sector',  12),
  ('nifty-it',            'Nifty IT',                 'IT',                    'sector',  13),
  ('nifty-pharma',        'Nifty Pharma',             'Pharma',                'sector',  14),
  ('nifty-healthcare',    'Nifty Healthcare Index',   'Healthcare',            'sector',  15),
  ('nifty-fmcg',          'Nifty FMCG',               'FMCG',                  'sector',  16),
  ('nifty-auto',          'Nifty Auto',               'Auto',                  'sector',  17),
  ('nifty-metal',         'Nifty Metal',              'Metal',                 'sector',  18),
  ('nifty-energy',        'Nifty Energy',             'Energy',                'sector',  19),
  ('nifty-oil-gas',       'Nifty Oil & Gas',          'Oil & Gas',             'sector',  20),
  ('nifty-realty',        'Nifty Realty',             'Realty',                'sector',  21),
  ('nifty-media',         'Nifty Media',              'Media',                 'sector',  22),
  ('nifty-cons-durables', 'Nifty Consumer Durables',  'Consumer Durables',     'sector',  23),
  ('nifty-infra',         'Nifty Infrastructure',     'Infrastructure',        'thematic', 30),
  ('nifty-cpse',          'Nifty CPSE',               'CPSE',                  'thematic', 31),
  ('nifty-pse',           'Nifty PSE',                'PSE',                   'thematic', 32),
  ('nifty-commodities',   'Nifty Commodities',        'Commodities',           'thematic', 33),
  ('nifty-defence',       'Nifty India Defence',      'Defence',               'thematic', 34),
  ('nifty-manufacturing', 'Nifty India Manufacturing','Manufacturing',         'thematic', 35)
on conflict (key) do update set nse_name = excluded.nse_name, label = excluded.label, kind = excluded.kind, sort = excluded.sort;

-- Row-level security
alter table public.industry_map     enable row level security;
alter table public.sector_overrides enable row level security;
alter table public.tracked_indices  enable row level security;
alter table public.index_prices     enable row level security;

revoke all on public.industry_map, public.sector_overrides, public.tracked_indices, public.index_prices from anon;
revoke all on public.industry_map, public.tracked_indices, public.index_prices from authenticated;
grant select on public.industry_map, public.tracked_indices, public.index_prices to authenticated;

drop policy if exists "industry_map: signed-in read"    on public.industry_map;
drop policy if exists "tracked_indices: signed-in read" on public.tracked_indices;
drop policy if exists "index_prices: signed-in read"    on public.index_prices;
create policy "industry_map: signed-in read"    on public.industry_map    for select to authenticated using (true);
create policy "tracked_indices: signed-in read" on public.tracked_indices for select to authenticated using (true);
create policy "index_prices: signed-in read"    on public.index_prices    for select to authenticated using (true);

revoke all on public.sector_overrides from authenticated;
grant select, insert, update, delete on public.sector_overrides to authenticated;
drop policy if exists "sector_overrides: own" on public.sector_overrides;
create policy "sector_overrides: own" on public.sector_overrides for all to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
