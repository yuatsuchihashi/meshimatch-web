-- ============================================================
-- 009: プロフィール bio + アレルギー/食事制限の自由記入化
-- ============================================================

alter table profiles add column if not exists bio text;
alter table profiles add column if not exists allergy_note text;
alter table profiles add column if not exists dietary_note text;
