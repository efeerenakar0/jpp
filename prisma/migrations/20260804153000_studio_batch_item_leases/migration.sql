-- Studio image workers may run concurrently and may be retried by Vercel.
-- Add an idempotent lease/retry state so one image is processed by one worker.

CREATE TABLE IF NOT EXISTS "_JasmineDeployMigration" (
  "name" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "_JasmineDeployMigration"
    WHERE "name" = '20260804153000_studio_batch_item_leases'
  ) THEN
    RETURN;
  END IF;

  ALTER TABLE "StudioBatchItem"
    ADD COLUMN "attemptCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "lastAttemptAt" TIMESTAMP(3),
    ADD COLUMN "nextAttemptAt" TIMESTAMP(3),
    ADD COLUMN "leaseOwner" TEXT,
    ADD COLUMN "leaseExpiresAt" TIMESTAMP(3);

  CREATE INDEX "StudioBatchItem_status_nextAttemptAt_leaseExpiresAt_idx"
    ON "StudioBatchItem"("status", "nextAttemptAt", "leaseExpiresAt");

  INSERT INTO "_JasmineDeployMigration" ("name")
  VALUES ('20260804153000_studio_batch_item_leases');
END
$migration$;
