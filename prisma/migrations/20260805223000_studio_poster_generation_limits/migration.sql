-- Tenant-scoped, server-enforced poster regeneration limits and attempt audit.
-- Safe to execute on every Vercel build through the shared deployment marker.

CREATE TABLE IF NOT EXISTS "_JasmineDeployMigration" (
  "name" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('20260805223000_studio_poster_generation_limits'));

  IF EXISTS (
    SELECT 1 FROM "_JasmineDeployMigration"
    WHERE "name" = '20260805223000_studio_poster_generation_limits'
  ) THEN
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS "StudioPosterGeneration" (
    "id" TEXT PRIMARY KEY,
    "companyAccountId" TEXT NOT NULL,
    "propertyId" TEXT,
    "createdByMemberId" TEXT,
    "logicalFingerprint" TEXT NOT NULL,
    "initialRequestKey" TEXT NOT NULL,
    "regenerationCount" INTEGER NOT NULL DEFAULT 0,
    "maxRegenerations" INTEGER NOT NULL DEFAULT 2,
    "version" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "StudioPosterGenerationAttempt" (
    "id" TEXT PRIMARY KEY,
    "companyAccountId" TEXT NOT NULL,
    "generationId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSING',
    "requestFingerprint" TEXT NOT NULL,
    "resultDigest" TEXT,
    "failureCode" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "StudioPosterGeneration_company_initial_request_key"
    ON "StudioPosterGeneration"("companyAccountId", "initialRequestKey");
  CREATE UNIQUE INDEX IF NOT EXISTS "StudioPosterGeneration_company_fingerprint_key"
    ON "StudioPosterGeneration"("companyAccountId", "logicalFingerprint");
  CREATE INDEX IF NOT EXISTS "StudioPosterGeneration_company_property_created_idx"
    ON "StudioPosterGeneration"("companyAccountId", "propertyId", "createdAt");
  CREATE UNIQUE INDEX IF NOT EXISTS "StudioPosterAttempt_company_idempotency_key"
    ON "StudioPosterGenerationAttempt"("companyAccountId", "idempotencyKey");
  CREATE UNIQUE INDEX IF NOT EXISTS "StudioPosterAttempt_generation_sequence_key"
    ON "StudioPosterGenerationAttempt"("generationId", "sequence");
  CREATE INDEX IF NOT EXISTS "StudioPosterAttempt_company_generation_status_idx"
    ON "StudioPosterGenerationAttempt"("companyAccountId", "generationId", "status");
  CREATE INDEX IF NOT EXISTS "StudioPosterAttempt_generation_kind_status_idx"
    ON "StudioPosterGenerationAttempt"("generationId", "kind", "status");

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudioPosterGeneration_company_fkey'
      AND conrelid = '"StudioPosterGeneration"'::regclass
  ) THEN
    ALTER TABLE "StudioPosterGeneration" ADD CONSTRAINT "StudioPosterGeneration_company_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudioPosterGeneration_property_fkey'
      AND conrelid = '"StudioPosterGeneration"'::regclass
  ) THEN
    ALTER TABLE "StudioPosterGeneration" ADD CONSTRAINT "StudioPosterGeneration_property_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudioPosterGeneration_member_fkey'
      AND conrelid = '"StudioPosterGeneration"'::regclass
  ) THEN
    ALTER TABLE "StudioPosterGeneration" ADD CONSTRAINT "StudioPosterGeneration_member_fkey"
      FOREIGN KEY ("createdByMemberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudioPosterAttempt_company_fkey'
      AND conrelid = '"StudioPosterGenerationAttempt"'::regclass
  ) THEN
    ALTER TABLE "StudioPosterGenerationAttempt" ADD CONSTRAINT "StudioPosterAttempt_company_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'StudioPosterAttempt_generation_fkey'
      AND conrelid = '"StudioPosterGenerationAttempt"'::regclass
  ) THEN
    ALTER TABLE "StudioPosterGenerationAttempt" ADD CONSTRAINT "StudioPosterAttempt_generation_fkey"
      FOREIGN KEY ("generationId") REFERENCES "StudioPosterGeneration"("id") ON DELETE CASCADE;
  END IF;

  INSERT INTO "_JasmineDeployMigration" ("name")
  VALUES ('20260805223000_studio_poster_generation_limits');
END
$migration$;
