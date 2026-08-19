-- Persist successful AI poster outputs so a paid generation can always be reopened.
-- Safe to execute on every Vercel build through the shared deployment marker.

CREATE TABLE IF NOT EXISTS "_JasmineDeployMigration" (
  "name" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('20260818063000_studio_poster_output_recovery'));

  IF EXISTS (
    SELECT 1 FROM "_JasmineDeployMigration"
    WHERE "name" = '20260818063000_studio_poster_output_recovery'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE "StudioPosterGenerationAttempt"
    ADD COLUMN IF NOT EXISTS "outputUrl" TEXT,
    ADD COLUMN IF NOT EXISTS "outputStorageKey" TEXT,
    ADD COLUMN IF NOT EXISTS "outputMimeType" TEXT,
    ADD COLUMN IF NOT EXISTS "outputByteSize" INTEGER,
    ADD COLUMN IF NOT EXISTS "providerCostUsd" DOUBLE PRECISION,
    ADD COLUMN IF NOT EXISTS "providerRequestId" TEXT;

  INSERT INTO "_JasmineDeployMigration" ("name")
  VALUES ('20260818063000_studio_poster_output_recovery');
END
$migration$;
