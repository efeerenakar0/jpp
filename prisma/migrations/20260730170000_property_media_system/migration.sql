ALTER TYPE "AiProvider" ADD VALUE IF NOT EXISTS 'STABILITY';

DO $$ BEGIN
  CREATE TYPE "PropertyMediaType" AS ENUM ('PHOTO', 'POSTER', 'MARKETING_ASSET');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PropertyMediaSource" AS ENUM ('MANUAL_UPLOAD', 'HUNTER', 'STUDIO_ENHANCED', 'POSTER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "PropertyMediaVariant" AS ENUM ('ORIGINAL', 'ENHANCED', 'CREATIVE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "MediaUsageRightsStatus" AS ENUM ('CONFIRMED', 'UNVERIFIED', 'RESTRICTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StudioBatchStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'PARTIAL', 'ATTACHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  CREATE TYPE "StudioBatchItemStatus" AS ENUM ('PENDING', 'UPLOADING', 'PROCESSING', 'COMPLETED', 'FAILED', 'ATTACHED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "CrmPropertyMedia" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "url" TEXT NOT NULL,
  "storageKey" TEXT,
  "fileName" TEXT NOT NULL,
  "mimeType" TEXT NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "byteSize" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "isCover" BOOLEAN NOT NULL DEFAULT false,
  "mediaType" "PropertyMediaType" NOT NULL DEFAULT 'PHOTO',
  "source" "PropertyMediaSource" NOT NULL DEFAULT 'MANUAL_UPLOAD',
  "variantType" "PropertyMediaVariant" NOT NULL DEFAULT 'ORIGINAL',
  "parentMediaId" TEXT,
  "prompt" TEXT,
  "aiProvider" TEXT,
  "aiModel" TEXT,
  "usageRightsStatus" "MediaUsageRightsStatus" NOT NULL DEFAULT 'CONFIRMED',
  "fingerprint" TEXT,
  "provenance" JSONB,
  "createdByMemberId" TEXT,
  "archivedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "CrmPropertyMedia_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudioBatch" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "propertyId" TEXT,
  "prompt" TEXT NOT NULL,
  "preset" TEXT,
  "provider" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "status" "StudioBatchStatus" NOT NULL DEFAULT 'PENDING',
  "createdByMemberId" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "errorSummary" TEXT,
  "startedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudioBatch_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "StudioBatchItem" (
  "id" TEXT NOT NULL,
  "batchId" TEXT NOT NULL,
  "sourceMediaId" TEXT,
  "originalUrl" TEXT NOT NULL,
  "originalStorageKey" TEXT,
  "originalFileName" TEXT NOT NULL,
  "originalMimeType" TEXT NOT NULL,
  "originalWidth" INTEGER,
  "originalHeight" INTEGER,
  "originalByteSize" INTEGER,
  "outputUrl" TEXT,
  "outputStorageKey" TEXT,
  "outputFileName" TEXT,
  "outputMimeType" TEXT,
  "outputWidth" INTEGER,
  "outputHeight" INTEGER,
  "outputByteSize" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "status" "StudioBatchItemStatus" NOT NULL DEFAULT 'PENDING',
  "errorMessage" TEXT,
  "attachedMediaId" TEXT,
  "fingerprint" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "StudioBatchItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmPropertyMedia_companyAccountId_propertyId_fingerprint_key"
  ON "CrmPropertyMedia"("companyAccountId", "propertyId", "fingerprint");
CREATE INDEX IF NOT EXISTS "CrmPropertyMedia_companyAccountId_propertyId_archivedAt_sortOrder_idx"
  ON "CrmPropertyMedia"("companyAccountId", "propertyId", "archivedAt", "sortOrder");
CREATE INDEX IF NOT EXISTS "CrmPropertyMedia_propertyId_isCover_archivedAt_idx"
  ON "CrmPropertyMedia"("propertyId", "isCover", "archivedAt");
CREATE INDEX IF NOT EXISTS "CrmPropertyMedia_parentMediaId_idx"
  ON "CrmPropertyMedia"("parentMediaId");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmPropertyMedia_one_active_cover_per_property"
  ON "CrmPropertyMedia"("propertyId")
  WHERE "isCover" = true AND "archivedAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "StudioBatch_companyAccountId_idempotencyKey_key"
  ON "StudioBatch"("companyAccountId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "StudioBatch_companyAccountId_createdAt_idx"
  ON "StudioBatch"("companyAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioBatch_propertyId_createdAt_idx"
  ON "StudioBatch"("propertyId", "createdAt");
CREATE INDEX IF NOT EXISTS "StudioBatch_status_expiresAt_idx"
  ON "StudioBatch"("status", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "StudioBatchItem_batchId_fingerprint_key"
  ON "StudioBatchItem"("batchId", "fingerprint");
CREATE INDEX IF NOT EXISTS "StudioBatchItem_batchId_status_sortOrder_idx"
  ON "StudioBatchItem"("batchId", "status", "sortOrder");
CREATE INDEX IF NOT EXISTS "StudioBatchItem_sourceMediaId_idx"
  ON "StudioBatchItem"("sourceMediaId");
CREATE INDEX IF NOT EXISTS "StudioBatchItem_attachedMediaId_idx"
  ON "StudioBatchItem"("attachedMediaId");

DO $$ BEGIN
  ALTER TABLE "CrmPropertyMedia"
    ADD CONSTRAINT "CrmPropertyMedia_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CrmPropertyMedia"
    ADD CONSTRAINT "CrmPropertyMedia_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CrmPropertyMedia"
    ADD CONSTRAINT "CrmPropertyMedia_parentMediaId_fkey"
    FOREIGN KEY ("parentMediaId") REFERENCES "CrmPropertyMedia"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "CrmPropertyMedia"
    ADD CONSTRAINT "CrmPropertyMedia_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "CompanyMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioBatch"
    ADD CONSTRAINT "StudioBatch_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioBatch"
    ADD CONSTRAINT "StudioBatch_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioBatch"
    ADD CONSTRAINT "StudioBatch_createdByMemberId_fkey"
    FOREIGN KEY ("createdByMemberId") REFERENCES "CompanyMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "StudioBatchItem"
    ADD CONSTRAINT "StudioBatchItem_batchId_fkey"
    FOREIGN KEY ("batchId") REFERENCES "StudioBatch"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioBatchItem"
    ADD CONSTRAINT "StudioBatchItem_sourceMediaId_fkey"
    FOREIGN KEY ("sourceMediaId") REFERENCES "CrmPropertyMedia"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StudioBatchItem"
    ADD CONSTRAINT "StudioBatchItem_attachedMediaId_fkey"
    FOREIGN KEY ("attachedMediaId") REFERENCES "CrmPropertyMedia"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Existing cover URLs are imported without downloading external data.
-- Their provenance and usage rights remain conservative until reviewed.
INSERT INTO "CrmPropertyMedia" (
  "id",
  "companyAccountId",
  "propertyId",
  "url",
  "fileName",
  "mimeType",
  "sortOrder",
  "isCover",
  "mediaType",
  "source",
  "variantType",
  "usageRightsStatus",
  "fingerprint",
  "provenance",
  "createdAt",
  "updatedAt"
)
SELECT
  CONCAT('pm_', md5(p."id" || ':' || p."imageUrl")),
  p."companyAccountId",
  p."id",
  p."imageUrl",
  CONCAT('legacy-cover-', p."id", '.jpg'),
  'image/jpeg',
  0,
  true,
  'PHOTO',
  'MANUAL_UPLOAD',
  'ORIGINAL',
  'UNVERIFIED',
  CONCAT('legacy:', md5(p."imageUrl")),
  jsonb_build_object('migration', '20260730170000_property_media_system', 'legacyImageUrl', true),
  p."createdAt",
  CURRENT_TIMESTAMP
FROM "CrmProperty" p
WHERE p."imageUrl" IS NOT NULL
  AND length(trim(p."imageUrl")) > 0
ON CONFLICT DO NOTHING;
