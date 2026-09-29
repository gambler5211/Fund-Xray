-- Day 6 follow-up: keep all four levels of NSE's classification when we have them (from NSE's
-- quote page, used for stocks outside the index lists), and allow "ETFs & funds" as a sector.

alter table public.industry_map add column if not exists macro text;
alter table public.industry_map add column if not exists industry_detail text;
alter table public.industry_map add column if not exists basic_industry text;

alter table public.sector_overrides drop constraint if exists sector_overrides_industry_check;
alter table public.sector_overrides add constraint sector_overrides_industry_check check (industry in (
  'Automobile and Auto Components', 'Capital Goods', 'Chemicals', 'Construction', 'Construction Materials',
  'Consumer Durables', 'Consumer Services', 'Diversified', 'Fast Moving Consumer Goods', 'Financial Services',
  'Forest Materials', 'Healthcare', 'Information Technology', 'Media Entertainment & Publication',
  'Metals & Mining', 'Oil Gas & Consumable Fuels', 'Power', 'Realty', 'Services', 'Telecommunication',
  'Textiles', 'Utilities', 'ETFs & funds'));
