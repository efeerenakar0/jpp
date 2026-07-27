ALTER TYPE "HuntingStatus" ADD VALUE IF NOT EXISTS 'AUTHORIZED';

ALTER TABLE "HuntedListing"
  ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorizationNote" TEXT,
  ADD COLUMN IF NOT EXISTS "authorizedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "eliminationReason" TEXT,
  ADD COLUMN IF NOT EXISTS "eliminationNote" TEXT,
  ADD COLUMN IF NOT EXISTS "eliminationSummary" TEXT,
  ADD COLUMN IF NOT EXISTS "eliminatedAt" TIMESTAMP(3);

UPDATE "HuntedListing"
SET "companyAccountId" = (
  SELECT "id"
  FROM "CompanyAccount"
  WHERE "slug" = 'jasmine-group'
  LIMIT 1
)
WHERE "companyAccountId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "HuntedListing_companyAccountId_sourceUrl_key"
  ON "HuntedListing"("companyAccountId", "sourceUrl");
CREATE INDEX IF NOT EXISTS "HuntedListing_companyAccountId_status_updatedAt_idx"
  ON "HuntedListing"("companyAccountId", "status", "updatedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'HuntedListing_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "HuntedListing"
      ADD CONSTRAINT "HuntedListing_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PortfolioSource" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "baseUrl" TEXT,
  "feedPath" TEXT,
  "encryptedCredential" TEXT,
  "credentialHint" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastSyncStatus" TEXT NOT NULL DEFAULT 'READY',
  "lastSyncError" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioSource_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PortfolioSource_companyAccountId_active_idx"
  ON "PortfolioSource"("companyAccountId", "active");
CREATE INDEX IF NOT EXISTS "PortfolioSource_companyAccountId_lastSyncStatus_idx"
  ON "PortfolioSource"("companyAccountId", "lastSyncStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioSource_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "PortfolioSource"
      ADD CONSTRAINT "PortfolioSource_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "PortfolioImportItem" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "sourceId" TEXT,
  "huntedListingId" TEXT,
  "propertyId" TEXT,
  "externalId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "sourceUrl" TEXT,
  "title" TEXT NOT NULL,
  "location" TEXT,
  "price" DOUBLE PRECISION,
  "roomCount" TEXT,
  "area" DOUBLE PRECISION,
  "description" TEXT,
  "imageUrl" TEXT,
  "rawPayload" TEXT,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "reviewNote" TEXT,
  "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PortfolioImportItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioImportItem_huntedListingId_key"
  ON "PortfolioImportItem"("huntedListingId");
CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioImportItem_propertyId_key"
  ON "PortfolioImportItem"("propertyId");
CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioImportItem_companyAccountId_fingerprint_key"
  ON "PortfolioImportItem"("companyAccountId", "fingerprint");
CREATE INDEX IF NOT EXISTS "PortfolioImportItem_companyAccountId_status_createdAt_idx"
  ON "PortfolioImportItem"("companyAccountId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "PortfolioImportItem_sourceId_status_idx"
  ON "PortfolioImportItem"("sourceId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioImportItem_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "PortfolioImportItem"
      ADD CONSTRAINT "PortfolioImportItem_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioImportItem_sourceId_fkey'
  ) THEN
    ALTER TABLE "PortfolioImportItem"
      ADD CONSTRAINT "PortfolioImportItem_sourceId_fkey"
      FOREIGN KEY ("sourceId") REFERENCES "PortfolioSource"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioImportItem_huntedListingId_fkey'
  ) THEN
    ALTER TABLE "PortfolioImportItem"
      ADD CONSTRAINT "PortfolioImportItem_huntedListingId_fkey"
      FOREIGN KEY ("huntedListingId") REFERENCES "HuntedListing"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioImportItem_propertyId_fkey'
  ) THEN
    ALTER TABLE "PortfolioImportItem"
      ADD CONSTRAINT "PortfolioImportItem_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
