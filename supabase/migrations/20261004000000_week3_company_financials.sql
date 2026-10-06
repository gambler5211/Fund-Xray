-- Week 3, Day 5: company financials from NSE's results filings.
--
-- company_financials  one row per company, quarter and basis (consolidated or standalone), as read
--                     from that quarter's XBRL filing by jobs/import_financials.py. Raw figures only;
--                     per-share values on today's share count are worked out by the engine.
--   eps_q / eps_ytd   basic EPS for the quarter and for the year to date (rupees)
--   ytd_months        3, 6, 9 or 12: how much of the April-March year eps_ytd, ocf_ytd, capex_ytd cover
--   shares            paid-up capital / face value, as filed that quarter
--   equity            owners' equity at the quarter end (half-year and year-end filings only)
--   ocf_ytd           operating cash flow, year to date (half-year and year-end filings only)
--   capex_ytd         purchases of property, plant, equipment and intangibles, year to date
--   revenue_q, profit_q  for Week 4's earnings red flag
--   source_url        the XBRL file it came from, shown under every number that uses it
-- Facts from public filings, not advice: every signed-in user can read them; only jobs write them.

create table if not exists public.company_financials (
  symbol        text not null,                 -- NSE symbol
  period_end    date not null,
  consolidated  boolean not null,
  kind          text not null default 'indas' check (kind in ('indas', 'banking')),
  ytd_months    smallint check (ytd_months in (3, 6, 9, 12)),
  eps_q         numeric,
  eps_ytd       numeric,
  shares        numeric,
  equity        numeric,
  ocf_ytd       numeric,
  capex_ytd     numeric,
  revenue_q     numeric,
  profit_q      numeric,
  filed_at      timestamptz,                   -- when NSE published it
  source_url    text not null,
  imported_at   timestamptz not null default now(),
  primary key (symbol, period_end, consolidated)
);
create index if not exists company_financials_symbol_end on public.company_financials (symbol, period_end desc);

-- Filings the importer tried and couldn't read, so it doesn't fetch them again every night.
create table if not exists public.financials_skipped (
  source_url  text primary key,
  symbol      text not null,
  reason      text not null,
  tried_at    timestamptz not null default now()
);

alter table public.company_financials enable row level security;
alter table public.financials_skipped enable row level security;
revoke all on public.company_financials, public.financials_skipped from anon;
revoke all on public.company_financials, public.financials_skipped from authenticated;
grant select on public.company_financials to authenticated;

drop policy if exists "company_financials: signed-in read" on public.company_financials;
create policy "company_financials: signed-in read" on public.company_financials for select to authenticated using (true);
