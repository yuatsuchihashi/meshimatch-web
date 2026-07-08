-- ============================================================
-- 011: 気分ID保存 (編集プリフィルとプロフィール普段設定の統一用)
-- ============================================================

alter table survey_responses add column if not exists prefer_moods jsonb not null default '[]'::jsonb;
alter table survey_responses add column if not exists avoid_moods jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists usual_prefer_moods jsonb not null default '[]'::jsonb;
alter table profiles add column if not exists usual_avoid_moods jsonb not null default '[]'::jsonb;
