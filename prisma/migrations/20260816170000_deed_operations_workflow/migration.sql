-- Adds the operational data needed to follow a deed case from preparation to closing.
ALTER TABLE "DeedTrackingCase"
  ADD COLUMN IF NOT EXISTS "guideId" TEXT,
  ADD COLUMN IF NOT EXISTS "workflow" JSONB;

CREATE INDEX IF NOT EXISTS "DeedTrackingCase_company_guide_idx"
  ON "DeedTrackingCase"("companyAccountId", "guideId");
