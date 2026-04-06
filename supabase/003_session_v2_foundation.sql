-- ============================================================
-- MeshiMatch – Session v2 Foundation
-- ============================================================
-- Incremental migration for session-level matching inputs and
-- lightweight area metadata used by the v2 recommendation engine.
-- ============================================================

alter table profiles
  add column if not exists usual_budget_ideal_yen integer,
  add column if not exists usual_budget_max_yen integer,
  add column if not exists usual_budget_priority text
    check (usual_budget_priority in ('must', 'prefer', 'optional')),
  add column if not exists usual_areas text[] default '{}',
  add column if not exists favorite_genres jsonb not null default '[]'::jsonb,
  add column if not exists disliked_items text[] default '{}',
  add column if not exists dietary_restrictions jsonb not null default '[]'::jsonb;

alter table groups
  add column if not exists scheduled_at timestamptz,
  add column if not exists group_size integer,
  add column if not exists session_atmosphere text
    check (session_atmosphere in ('casual', 'polished', 'lively', 'calm')),
  add column if not exists session_focus text not null default 'balanced'
    check (session_focus in ('drink_centered', 'food_centered', 'balanced'));

alter table survey_responses
  add column if not exists response_version integer not null default 1,
  add column if not exists departure_area text,
  add column if not exists departure_station text,
  add column if not exists budget_ideal_yen integer,
  add column if not exists budget_max_yen integer,
  add column if not exists budget_priority text
    check (budget_priority in ('must', 'prefer', 'optional')),
  add column if not exists genre_preferences jsonb not null default '[]'::jsonb,
  add column if not exists genre_dislikes jsonb not null default '[]'::jsonb,
  add column if not exists dietary_restrictions jsonb not null default '[]'::jsonb;

create table if not exists area_catalog (
  id text primary key,
  display_name text not null unique,
  station_name text not null,
  area_kind text not null default 'district'
    check (area_kind in ('district', 'hub', 'discovery')),
  prefecture text not null default 'Tokyo',
  hub_score numeric(4,3) not null default 0
    check (hub_score >= 0 and hub_score <= 1),
  supply_score numeric(4,3) not null default 0
    check (supply_score >= 0 and supply_score <= 1),
  nightlife_score numeric(4,3) not null default 0
    check (nightlife_score >= 0 and nightlife_score <= 1),
  discovery_score numeric(4,3) not null default 0
    check (discovery_score >= 0 and discovery_score <= 1),
  reliability_score numeric(4,3) not null default 0
    check (reliability_score >= 0 and reliability_score <= 1),
  nearby_hubs text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_area_catalog_display_name
  on area_catalog(display_name);

create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists area_catalog_updated_at on area_catalog;

create trigger area_catalog_updated_at
  before update on area_catalog
  for each row execute function update_updated_at();

alter table area_catalog enable row level security;

drop policy if exists "dev_all_area_catalog" on area_catalog;

create policy "dev_all_area_catalog"
  on area_catalog for all
  using (true)
  with check (true);
