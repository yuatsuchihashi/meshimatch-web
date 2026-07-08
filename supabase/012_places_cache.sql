-- ============================================================
-- 012: Google Places キャッシュ列 (call-once 設計)
-- ============================================================

alter table restaurants add column if not exists place_id text;
alter table restaurants add column if not exists rating double precision;
