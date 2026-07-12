-- ============================================================
-- 023: R6a Google Places catalog provenance + TTL cache
-- ============================================================
-- 長期保存は restaurants.place_id と MeshiMatch 側の catalog provenance に限定。
-- Google Places の詳細 payload は places_cache に expires_at 付きで保存し、
-- 期限切れ時は再取得対象として扱う。

alter table restaurants add column if not exists catalog_source text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_catalog_source_check'
  ) then
    alter table restaurants
      add constraint restaurants_catalog_source_check
      check (catalog_source is null or catalog_source in ('catalog'));
  end if;
end $$;

create index if not exists idx_restaurants_place_id on restaurants (place_id);
create index if not exists idx_restaurants_catalog_source
  on restaurants (catalog_source)
  where catalog_source is not null;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'restaurant_sources_source_type_check'
  ) then
    alter table restaurant_sources
      drop constraint restaurant_sources_source_type_check;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'restaurant_sources_source_type_check'
  ) then
    alter table restaurant_sources
      add constraint restaurant_sources_source_type_check
      check (source_type in ('base_curated', 'endorsement', 'user_favorite', 'catalog'));
  end if;
end $$;

create table if not exists places_cache (
  place_id text primary key,
  raw_details jsonb not null,
  fetched_at timestamptz not null,
  expires_at timestamptz not null,
  source text not null default 'google_places_new',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (expires_at > fetched_at)
);

create index if not exists idx_places_cache_expires_at on places_cache (expires_at);

comment on column restaurants.catalog_source is
  'R6a provenance marker for quality-evaluation catalog rows. Catalog rows are not trust-ring candidates.';
comment on table places_cache is
  'TTL cache for raw Google Places detail payloads. Expired rows must be refetched before use.';
comment on column places_cache.raw_details is
  'Raw Google Places detail payload. Cache-only; do not copy raw detail fields into long-term tables.';
