-- Add budget_tier column to survey_responses (v2 single-tier selection)
ALTER TABLE survey_responses
  ADD COLUMN IF NOT EXISTS budget_tier integer;

-- Add usual_budget_tier to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS usual_budget_tier integer;

-- Old columns (budget_ideal_yen, budget_max_yen, budget_priority) are kept for backward compatibility
