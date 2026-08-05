-- Persistent, tenant-scoped AI cinematic video queue and private artifacts.
-- This file is executed on every Vercel build; the marker makes it idempotent.

CREATE TABLE IF NOT EXISTS "_JasmineDeployMigration" (
  "name" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "_JasmineDeployMigration"
    WHERE "name" = '20260804170000_studio_video_jobs'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'StudioVideoJobStatus'
  ) THEN
    CREATE TYPE "StudioVideoJobStatus" AS ENUM (
      'QUEUED',
      'SUBMITTING',
      'GENERATING',
      'PERSISTING',
      'COMPLETED',
      'FAILED',
      'CANCELLED',
      'EXPIRED'
    );
  END IF;

  CREATE TABLE IF NOT EXISTS "StudioVideoJob" (
    "id" TEXT PRIMARY KEY,
    "companyAccountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "createdByMemberId" TEXT,
    "prompt" TEXT NOT NULL,
    "userCommand" TEXT NOT NULL,
    "referenceMediaIds" TEXT[] NOT NULL,
    "referenceSnapshot" JSONB NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'BYTEPLUS',
    "model" TEXT NOT NULL,
    "providerTaskId" TEXT,
    "providerOutputUrl" TEXT,
    "durationSeconds" INTEGER NOT NULL DEFAULT 10,
    "ratio" TEXT NOT NULL DEFAULT '9:16',
    "resolution" TEXT NOT NULL DEFAULT '720p',
    "generateAudio" BOOLEAN NOT NULL DEFAULT false,
    "status" "StudioVideoJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 5,
    "idempotencyKey" TEXT NOT NULL,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "nextAttemptAt" TIMESTAMP(3),
    "leaseOwner" TEXT,
    "leaseExpiresAt" TIMESTAMP(3),
    "outputStorageKey" TEXT,
    "outputFileName" TEXT,
    "outputMimeType" TEXT,
    "outputByteSize" INTEGER,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "submittedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "StudioVideoJob_providerTaskId_key"
    ON "StudioVideoJob"("providerTaskId");
  CREATE UNIQUE INDEX IF NOT EXISTS "StudioVideoJob_company_idempotency_key"
    ON "StudioVideoJob"("companyAccountId", "idempotencyKey");
  CREATE INDEX IF NOT EXISTS "StudioVideoJob_company_created_idx"
    ON "StudioVideoJob"("companyAccountId", "createdAt");
  CREATE INDEX IF NOT EXISTS "StudioVideoJob_company_property_created_idx"
    ON "StudioVideoJob"("companyAccountId", "propertyId", "createdAt");
  CREATE INDEX IF NOT EXISTS "StudioVideoJob_worker_idx"
    ON "StudioVideoJob"("status", "nextAttemptAt", "leaseExpiresAt");
  CREATE INDEX IF NOT EXISTS "StudioVideoJob_expiry_idx"
    ON "StudioVideoJob"("expiresAt", "status");

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudioVideoJob_company_fkey'
      AND conrelid = '"StudioVideoJob"'::regclass
  ) THEN
    ALTER TABLE "StudioVideoJob"
      ADD CONSTRAINT "StudioVideoJob_company_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudioVideoJob_property_fkey'
      AND conrelid = '"StudioVideoJob"'::regclass
  ) THEN
    ALTER TABLE "StudioVideoJob"
      ADD CONSTRAINT "StudioVideoJob_property_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudioVideoJob_member_fkey'
      AND conrelid = '"StudioVideoJob"'::regclass
  ) THEN
    ALTER TABLE "StudioVideoJob"
      ADD CONSTRAINT "StudioVideoJob_member_fkey"
      FOREIGN KEY ("createdByMemberId") REFERENCES "CompanyMember"("id")
      ON DELETE SET NULL;
  END IF;

  INSERT INTO "_JasmineDeployMigration" ("name")
  VALUES ('20260804170000_studio_video_jobs');
END
$migration$;
