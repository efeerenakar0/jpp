CREATE TABLE IF NOT EXISTS "DeveloperWorkspace" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "websiteMode" TEXT NOT NULL DEFAULT 'UNDECIDED',
  "siteStatus" TEXT NOT NULL DEFAULT 'DRAFT',
  "temporarySlug" TEXT NOT NULL,
  "customHostname" TEXT,
  "cnameTarget" TEXT NOT NULL DEFAULT 'cname.vercel-dns-0.com',
  "domainStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "sslStatus" TEXT NOT NULL DEFAULT 'NOT_CONFIGURED',
  "brandName" TEXT NOT NULL,
  "logoData" TEXT,
  "primaryColor" TEXT NOT NULL DEFAULT '#0f766e',
  "accentColor" TEXT NOT NULL DEFAULT '#14b8a6',
  "selectedTheme" TEXT NOT NULL DEFAULT 'midnight-estate',
  "siteContent" JSONB NOT NULL DEFAULT '{}'::jsonb,
  "contactEmail" TEXT,
  "contactPhone" TEXT,
  "whatsappPhone" TEXT,
  "address" TEXT,
  "socialAccounts" JSONB NOT NULL DEFAULT '[]'::jsonb,
  "aiUsageDay" TIMESTAMP(3),
  "aiUsageCount" INTEGER NOT NULL DEFAULT 0,
  "lastDomainCheckAt" TIMESTAMP(3),
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DeveloperWorkspace_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "DeveloperWorkspace"
  ADD COLUMN IF NOT EXISTS "selectedTheme" TEXT NOT NULL DEFAULT 'midnight-estate',
  ADD COLUMN IF NOT EXISTS "siteContent" JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS "aiUsageDay" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "aiUsageCount" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX IF NOT EXISTS "DeveloperWorkspace_companyAccountId_key"
ON "DeveloperWorkspace"("companyAccountId");

CREATE UNIQUE INDEX IF NOT EXISTS "DeveloperWorkspace_temporarySlug_key"
ON "DeveloperWorkspace"("temporarySlug");

CREATE UNIQUE INDEX IF NOT EXISTS "DeveloperWorkspace_customHostname_key"
ON "DeveloperWorkspace"("customHostname");

CREATE INDEX IF NOT EXISTS "DeveloperWorkspace_site_status_idx"
ON "DeveloperWorkspace"("siteStatus", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeveloperWorkspace_company_fkey'
  ) THEN
    ALTER TABLE "DeveloperWorkspace"
      ADD CONSTRAINT "DeveloperWorkspace_company_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
