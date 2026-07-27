ALTER TABLE "GeneralManagerMessage"
  ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorId" TEXT,
  ADD COLUMN IF NOT EXISTS "authorName" TEXT,
  ADD COLUMN IF NOT EXISTS "authorType" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT;

UPDATE "GeneralManagerMessage"
SET
  "companyAccountId" = (
    SELECT "id"
    FROM "CompanyAccount"
    WHERE "slug" = 'jasmine-group'
    LIMIT 1
  ),
  "authorName" = CASE
    WHEN "role" = 'patron' THEN 'Patron'
    ELSE 'Genel Müdür Yardımcısı'
  END,
  "authorType" = CASE
    WHEN "role" = 'patron' THEN 'OWNER'
    ELSE 'AI'
  END
WHERE "companyAccountId" IS NULL;

CREATE INDEX IF NOT EXISTS "GeneralManagerMessage_companyAccountId_createdAt_idx"
  ON "GeneralManagerMessage"("companyAccountId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'GeneralManagerMessage_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "GeneralManagerMessage"
      ADD CONSTRAINT "GeneralManagerMessage_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
