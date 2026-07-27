ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'OPENROUTER';

ALTER TABLE "AdCampaign"
  ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "propertyId" TEXT,
  ADD COLUMN IF NOT EXISTS "objective" TEXT,
  ADD COLUMN IF NOT EXISTS "audience" TEXT,
  ADD COLUMN IF NOT EXISTS "tone" TEXT,
  ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'DRAFT',
  ADD COLUMN IF NOT EXISTS "posterTemplate" TEXT,
  ADD COLUMN IF NOT EXISTS "posterHeadline" TEXT,
  ADD COLUMN IF NOT EXISTS "posterSubline" TEXT,
  ADD COLUMN IF NOT EXISTS "posterCta" TEXT,
  ADD COLUMN IF NOT EXISTS "generatedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "generatedModel" TEXT;

UPDATE "AdCampaign"
SET "companyAccountId" = (
  SELECT "id"
  FROM "CompanyAccount"
  WHERE "slug" = 'jasmine-group'
  LIMIT 1
)
WHERE "companyAccountId" IS NULL;

CREATE INDEX IF NOT EXISTS "AdCampaign_companyAccountId_createdAt_idx"
  ON "AdCampaign"("companyAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "AdCampaign_companyAccountId_type_idx"
  ON "AdCampaign"("companyAccountId", "type");
CREATE INDEX IF NOT EXISTS "AdCampaign_propertyId_idx"
  ON "AdCampaign"("propertyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AdCampaign_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "AdCampaign"
      ADD CONSTRAINT "AdCampaign_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AdCampaign_propertyId_fkey'
  ) THEN
    ALTER TABLE "AdCampaign"
      ADD CONSTRAINT "AdCampaign_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "MarketingWebsiteAnalysis" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "websiteUrl" TEXT NOT NULL,
  "domain" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'READY',
  "summary" TEXT NOT NULL,
  "strengths" TEXT NOT NULL,
  "opportunities" TEXT NOT NULL,
  "channelPlan" TEXT NOT NULL,
  "firstActions" TEXT NOT NULL,
  "generatedBy" TEXT NOT NULL,
  "generatedModel" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingWebsiteAnalysis_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "MarketingWebsiteAnalysis_companyAccountId_createdAt_idx"
  ON "MarketingWebsiteAnalysis"("companyAccountId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MarketingWebsiteAnalysis_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "MarketingWebsiteAnalysis"
      ADD CONSTRAINT "MarketingWebsiteAnalysis_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
