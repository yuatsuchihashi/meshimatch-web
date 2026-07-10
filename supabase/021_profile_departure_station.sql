-- ============================================================
-- 021: プロフィール既定出発駅 (raw station)
-- ============================================================
-- 計画モードsurveyではこの既定値をワンタップ確認し、回答には最終的な駅名だけを保存する。

alter table profiles
  add column if not exists usual_departure_station text;

comment on column profiles.usual_departure_station is
  'Default raw station for planned-mode surveys. Confirmation state is not stored.';
