-- Add budget_ceiling column (v3: single upper limit input)
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS budget_ceiling integer;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS usual_budget_ceiling integer;
