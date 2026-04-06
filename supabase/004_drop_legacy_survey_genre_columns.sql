-- ============================================================
-- MeshiMatch – Drop legacy survey genre columns
-- ============================================================
-- The app now uses v2-only genre preferences via `genre_preferences`.
-- Remove the old tier/disliked columns and set the v2 response default.
-- ============================================================

alter table survey_responses
  alter column response_version set default 2;

alter table survey_responses
  drop column if exists tier_s,
  drop column if exists tier_a,
  drop column if exists tier_b,
  drop column if exists disliked,
  drop column if exists genre_dislikes;
