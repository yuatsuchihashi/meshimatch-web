-- ============================================================
-- 013: 持ち寄り (アンケートでのおすすめ店登録)
-- ============================================================

alter table survey_responses add column if not exists suggested_restaurants jsonb not null default '[]'::jsonb;
