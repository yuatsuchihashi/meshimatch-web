-- ============================================================
-- 019: 推薦ソースの PR フラグ
-- ============================================================
-- カード上の「〇〇さんのお気に入り」等の attribution は
-- restaurant_sources が供給するため、PRラベルもこの推薦ソース単位で持つ。

alter table restaurant_sources add column if not exists pr boolean;

update restaurant_sources
set pr = false
where pr is null;

alter table restaurant_sources
  alter column pr set default false,
  alter column pr set not null;

comment on column restaurant_sources.pr is
  'True when this recommendation/source is PR or sponsored and must show a PR label plus ranking penalty.';

