ALTER TABLE "Notification"
  ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientMemberId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientKey" TEXT,
  ADD COLUMN IF NOT EXISTS "important" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dedupeKey" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Notification_companyAccountId_recipientKey_dedupeKey_key"
  ON "Notification"("companyAccountId", "recipientKey", "dedupeKey");

CREATE INDEX IF NOT EXISTS "Notification_companyAccountId_recipientKey_important_read_createdAt_idx"
  ON "Notification"(
    "companyAccountId",
    "recipientKey",
    "important",
    "read",
    "createdAt"
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId")
      REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'Notification_recipientMemberId_fkey'
  ) THEN
    ALTER TABLE "Notification"
      ADD CONSTRAINT "Notification_recipientMemberId_fkey"
      FOREIGN KEY ("recipientMemberId")
      REFERENCES "CompanyMember"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END
$$;
