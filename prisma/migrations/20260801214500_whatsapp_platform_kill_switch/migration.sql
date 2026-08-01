ALTER TABLE "WhatsAppConfig"
ADD COLUMN IF NOT EXISTS "platformEnabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "WhatsAppConfig"
ALTER COLUMN "allowFirstContact" SET DEFAULT true;

UPDATE "WhatsAppConfig"
SET
  "autoReplyEnabled" = true,
  "allowFirstContact" = true;
