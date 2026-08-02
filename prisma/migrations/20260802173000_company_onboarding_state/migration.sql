ALTER TABLE "CompanyAccount"
ADD COLUMN IF NOT EXISTS "onboardingState" JSONB,
ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3);

-- Existing customers keep their current workspace without a forced setup screen.
-- Accounts created after this migration start with NULL and receive the checklist.
UPDATE "CompanyAccount"
SET "onboardingCompletedAt" = CURRENT_TIMESTAMP
WHERE "onboardingCompletedAt" IS NULL;
