-- Versioned Website Connector request replay protection and durable rate limits.
CREATE TABLE IF NOT EXISTS "WebsiteRequestNonce" (
    "id" TEXT NOT NULL,
    "websiteIntegrationId" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebsiteRequestNonce_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "WebsiteRateLimitBucket" (
    "id" TEXT NOT NULL,
    "websiteIntegrationId" TEXT NOT NULL,
    "bucketStart" TIMESTAMP(3) NOT NULL,
    "requestCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WebsiteRateLimitBucket_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteRequestNonce_websiteIntegrationId_nonce_key"
ON "WebsiteRequestNonce"("websiteIntegrationId", "nonce");
CREATE INDEX IF NOT EXISTS "WebsiteRequestNonce_expiresAt_idx"
ON "WebsiteRequestNonce"("expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "WebsiteRateLimitBucket_websiteIntegrationId_bucketStart_key"
ON "WebsiteRateLimitBucket"("websiteIntegrationId", "bucketStart");
CREATE INDEX IF NOT EXISTS "WebsiteRateLimitBucket_bucketStart_idx"
ON "WebsiteRateLimitBucket"("bucketStart");

DO $$ BEGIN
  ALTER TABLE "WebsiteRequestNonce"
  ADD CONSTRAINT "WebsiteRequestNonce_websiteIntegrationId_fkey"
  FOREIGN KEY ("websiteIntegrationId") REFERENCES "WebsiteIntegration"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "WebsiteRateLimitBucket"
  ADD CONSTRAINT "WebsiteRateLimitBucket_websiteIntegrationId_fkey"
  FOREIGN KEY ("websiteIntegrationId") REFERENCES "WebsiteIntegration"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "GeneratedWebsite"
ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT,
ADD COLUMN IF NOT EXISTS "promptTemplate" TEXT;

UPDATE "GeneratedWebsite"
SET "promptTemplate" = 'Eski kayıt: entegrasyon promptu yeniden oluşturulmalıdır.'
WHERE "promptTemplate" IS NULL;

ALTER TABLE "GeneratedWebsite"
ALTER COLUMN "promptTemplate" SET NOT NULL;

CREATE INDEX IF NOT EXISTS "GeneratedWebsite_companyAccountId_createdAt_idx"
ON "GeneratedWebsite"("companyAccountId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "GeneratedWebsite"
  ADD CONSTRAINT "GeneratedWebsite_companyAccountId_fkey"
  FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
