-- ============================================================
-- 017: レストラン営業時間 + 項目別 provenance
-- ============================================================
-- HotPepper 等の外部API列は追加しない。営業時間は自前入力/公式入力/
-- Google Maps インポート由来の値だけを保持する。

do $$
begin
  if not exists (
    select 1 from pg_type where typname = 'restaurant_metadata_source'
  ) then
    create type restaurant_metadata_source as enum (
      'member_input',
      'official_input',
      'gmaps_import'
    );
  end if;
end $$;

alter table restaurants
  add column if not exists opening_hours jsonb,
  add column if not exists opening_hours_source restaurant_metadata_source,
  add column if not exists opening_hours_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'restaurants_opening_hours_provenance_check'
  ) then
    alter table restaurants
      add constraint restaurants_opening_hours_provenance_check
      check (
        (
          opening_hours is null and
          opening_hours_source is null and
          opening_hours_updated_at is null
        )
        or
        (
          opening_hours is not null and
          opening_hours_source is not null and
          opening_hours_updated_at is not null
        )
      );
  end if;
end $$;

comment on column restaurants.opening_hours is
  'Nullable structured opening-hours data supplied by member input, official input, or Google Maps import.';
comment on column restaurants.opening_hours_source is
  'Per-field provenance for opening_hours.';
comment on column restaurants.opening_hours_updated_at is
  'Timestamp for the currently stored opening_hours value.';

