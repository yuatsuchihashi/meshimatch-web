-- ============================================================
-- 010: アンケートのアレルギー・食事制限 自由記入化
-- ============================================================

alter table survey_responses add column if not exists allergy_note text;
alter table survey_responses add column if not exists dietary_note text;
