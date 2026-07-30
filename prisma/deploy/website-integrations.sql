CREATE TABLE IF NOT EXISTS "WebsiteIntegration" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "displayName" TEXT NOT NULL,
  "websiteUrl" TEXT NOT NULL,
  "websiteOrigin" TEXT NOT NULL,
  "framework" TEXT NOT NULL,
  "hostingProvider" TEXT NOT NULL,
  "portfolioPath" TEXT NOT NULL,
  "technicalContactEmail" TEXT NOT NULL,
  "repositoryUrl" TEXT,
  "notes" TEXT,
  "sourceBlobPathname" TEXT NOT NULL,
  "sourceFileName" TEXT NOT NULL,
  "sourceSize" INTEGER NOT NULL,
  "apiKeyLookup" TEXT NOT NULL,
  "apiKeyHint" TEXT NOT NULL,
  "apiKeyCreatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "promptTemplate" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebsiteIntegration_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteIntegration_apiKeyLookup_key"
  ON "WebsiteIntegration"("apiKeyLookup");
CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteIntegration_companyAccountId_websiteOrigin_key"
  ON "WebsiteIntegration"("companyAccountId", "websiteOrigin");
CREATE INDEX IF NOT EXISTS "WebsiteIntegration_companyAccountId_status_idx"
  ON "WebsiteIntegration"("companyAccountId", "status");
CREATE INDEX IF NOT EXISTS "WebsiteIntegration_status_createdAt_idx"
  ON "WebsiteIntegration"("status", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebsiteIntegration_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "WebsiteIntegration"
      ADD CONSTRAINT "WebsiteIntegration_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
