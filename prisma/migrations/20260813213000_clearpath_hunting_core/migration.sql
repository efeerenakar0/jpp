-- ClearPath Avci core: job-scoped Apify runs, DB quota/lock, shared cache and
-- duplicate-safe many-to-many job/listing history. Every statement is safe to
-- re-run by the Vercel build pipeline.

ALTER TABLE "HuntJob"
  ADD COLUMN IF NOT EXISTS "propertyType" TEXT,
  ADD COLUMN IF NOT EXISTS "requestedResults" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "quotaPeriodStart" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "quotaReserved" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "searchCacheId" TEXT,
  ADD COLUMN IF NOT EXISTS "apifyActorId" TEXT,
  ADD COLUMN IF NOT EXISTS "apifyRunId" TEXT,
  ADD COLUMN IF NOT EXISTS "apifyDatasetId" TEXT,
  ADD COLUMN IF NOT EXISTS "apifyStatus" TEXT,
  ADD COLUMN IF NOT EXISTS "actorInput" JSONB,
  ADD COLUMN IF NOT EXISTS "dispatchStrategy" TEXT NOT NULL DEFAULT 'CLEARPATH_CACHE_V1',
  ADD COLUMN IF NOT EXISTS "cacheHit" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "ingestedAt" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "HuntingSearchCache" (
  "id" TEXT NOT NULL,
  "cacheKey" TEXT NOT NULL,
  "provider" "SourceProvider" NOT NULL,
  "propertyType" TEXT NOT NULL,
  "searchUrl" TEXT NOT NULL,
  "strategyVersion" TEXT NOT NULL DEFAULT 'CLEARPATH_OWNER_ROTATION_V2',
  "status" TEXT NOT NULL DEFAULT 'FETCHING',
  "actorId" TEXT NOT NULL,
  "actorInput" JSONB NOT NULL,
  "requestedResults" INTEGER NOT NULL,
  "apifyRunId" TEXT,
  "apifyDatasetId" TEXT,
  "totalRaw" INTEGER NOT NULL DEFAULT 0,
  "totalAccepted" INTEGER NOT NULL DEFAULT 0,
  "totalRejected" INTEGER NOT NULL DEFAULT 0,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "errorSummary" TEXT,
  "dispatchLeaseId" TEXT,
  "dispatchLeaseUntil" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntingSearchCache_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HuntingSearchCacheItem" (
  "id" TEXT NOT NULL,
  "searchCacheId" TEXT NOT NULL,
  "sourceListingId" TEXT NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "deterministicRank" TEXT NOT NULL,
  "payloadJson" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntingSearchCacheItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "HuntJobListing" (
  "jobId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntJobListing_pkey" PRIMARY KEY ("jobId", "listingId")
);

CREATE TABLE IF NOT EXISTS "HuntingMonthlyQuota" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "propertyType" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "monthlyLimit" INTEGER NOT NULL,
  "reserved" INTEGER NOT NULL DEFAULT 0,
  "used" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntingMonthlyQuota_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HuntingMonthlyQuota_nonnegative_check"
    CHECK ("reserved" >= 0 AND "used" >= 0 AND "monthlyLimit" >= 0),
  CONSTRAINT "HuntingMonthlyQuota_limit_check"
    CHECK ("reserved" + "used" <= "monthlyLimit")
);

CREATE TABLE IF NOT EXISTS "HuntingActiveJobLock" (
  "companyAccountId" TEXT NOT NULL,
  "huntJobId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntingActiveJobLock_pkey" PRIMARY KEY ("companyAccountId")
);

DO $$ BEGIN
  ALTER TABLE "HuntJob"
    ADD CONSTRAINT "HuntJob_searchCacheId_fkey"
    FOREIGN KEY ("searchCacheId") REFERENCES "HuntingSearchCache"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HuntingSearchCacheItem"
    ADD CONSTRAINT "HuntingSearchCacheItem_searchCacheId_fkey"
    FOREIGN KEY ("searchCacheId") REFERENCES "HuntingSearchCache"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HuntJobListing"
    ADD CONSTRAINT "HuntJobListing_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "HuntJob"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HuntJobListing"
    ADD CONSTRAINT "HuntJobListing_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "HuntedListing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HuntingMonthlyQuota"
    ADD CONSTRAINT "HuntingMonthlyQuota_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HuntingActiveJobLock"
    ADD CONSTRAINT "HuntingActiveJobLock_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "HuntingActiveJobLock"
    ADD CONSTRAINT "HuntingActiveJobLock_huntJobId_fkey"
    FOREIGN KEY ("huntJobId") REFERENCES "HuntJob"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Several tenant-scoped jobs may consume one shared paid Actor run. The cache
-- owns run uniqueness; HuntJob only needs a lookup index.
DROP INDEX IF EXISTS "HuntJob_apifyRunId_key";
CREATE INDEX IF NOT EXISTS "HuntJob_apifyRunId_idx"
  ON "HuntJob"("apifyRunId");
CREATE INDEX IF NOT EXISTS "HuntJob_searchCacheId_status_idx"
  ON "HuntJob"("searchCacheId", "status");
CREATE INDEX IF NOT EXISTS "HuntJob_company_property_quotaPeriod_idx"
  ON "HuntJob"("companyAccountId", "propertyType", "quotaPeriodStart");

CREATE UNIQUE INDEX IF NOT EXISTS "HuntingSearchCache_cacheKey_key"
  ON "HuntingSearchCache"("cacheKey");
CREATE UNIQUE INDEX IF NOT EXISTS "HuntingSearchCache_apifyRunId_key"
  ON "HuntingSearchCache"("apifyRunId");
CREATE INDEX IF NOT EXISTS "HuntingSearchCache_status_expiresAt_idx"
  ON "HuntingSearchCache"("status", "expiresAt");
CREATE INDEX IF NOT EXISTS "HuntingSearchCache_propertyType_createdAt_idx"
  ON "HuntingSearchCache"("propertyType", "createdAt");
CREATE INDEX IF NOT EXISTS "HuntingSearchCache_dispatchLeaseUntil_idx"
  ON "HuntingSearchCache"("dispatchLeaseUntil");

CREATE UNIQUE INDEX IF NOT EXISTS "HuntingSearchCacheItem_cache_listing_key"
  ON "HuntingSearchCacheItem"("searchCacheId", "sourceListingId");
CREATE INDEX IF NOT EXISTS "HuntingSearchCacheItem_cache_rank_idx"
  ON "HuntingSearchCacheItem"("searchCacheId", "deterministicRank");

-- Contact data is tenant scoped and must never live in the global cache.
ALTER TABLE "HuntingSearchCacheItem" DROP COLUMN IF EXISTS "encryptedPhones";

CREATE UNIQUE INDEX IF NOT EXISTS "HuntJobListing_job_position_key"
  ON "HuntJobListing"("jobId", "position");
CREATE INDEX IF NOT EXISTS "HuntJobListing_listing_createdAt_idx"
  ON "HuntJobListing"("listingId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "HuntingMonthlyQuota_company_property_period_key"
  ON "HuntingMonthlyQuota"("companyAccountId", "propertyType", "periodStart");
CREATE INDEX IF NOT EXISTS "HuntingMonthlyQuota_company_periodEnd_idx"
  ON "HuntingMonthlyQuota"("companyAccountId", "periodEnd");

CREATE UNIQUE INDEX IF NOT EXISTS "HuntingActiveJobLock_huntJobId_key"
  ON "HuntingActiveJobLock"("huntJobId");
CREATE INDEX IF NOT EXISTS "HuntingActiveJobLock_expiresAt_idx"
  ON "HuntingActiveJobLock"("expiresAt");

-- Preserve job history for listings created before the M:N relationship.
INSERT INTO "HuntJobListing" ("jobId", "listingId", "position", "createdAt")
SELECT
  legacy."huntJobId",
  legacy."id",
  ROW_NUMBER() OVER (PARTITION BY legacy."huntJobId" ORDER BY legacy."createdAt", legacy."id")::INTEGER,
  legacy."createdAt"
FROM "HuntedListing" legacy
WHERE legacy."huntJobId" IS NOT NULL
ON CONFLICT DO NOTHING;
