ALTER TABLE "WhatsAppConfig"
  ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL DEFAULT 'EVOLUTION',
  ADD COLUMN IF NOT EXISTS "evolutionInstanceName" TEXT,
  ADD COLUMN IF NOT EXISTS "evolutionInstanceId" TEXT,
  ADD COLUMN IF NOT EXISTS "evolutionWebhookSecretHash" TEXT,
  ADD COLUMN IF NOT EXISTS "connectionStatus" TEXT NOT NULL DEFAULT 'DISCONNECTED',
  ADD COLUMN IF NOT EXISTS "connectedPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "connectedProfileName" TEXT,
  ADD COLUMN IF NOT EXISTS "lastConnectedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastHealthCheckAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastError" TEXT,
  ADD COLUMN IF NOT EXISTS "autoReplyEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS "allowFirstContact" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "dailyMessageLimit" INTEGER NOT NULL DEFAULT 80,
  ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE "WhatsAppConfig" ALTER COLUMN "id" DROP DEFAULT;

ALTER TABLE "CustomerConversation"
  ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT;

ALTER TABLE "WhatsAppMessage"
  ADD COLUMN IF NOT EXISTS "companyAccountId" TEXT,
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT;

UPDATE "WhatsAppConfig"
SET "companyAccountId" = (
  SELECT "id"
  FROM "CompanyAccount"
  WHERE "slug" = 'jasmine-group'
  LIMIT 1
)
WHERE "companyAccountId" IS NULL;

UPDATE "CustomerConversation"
SET "companyAccountId" = (
  SELECT "id"
  FROM "CompanyAccount"
  WHERE "slug" = 'jasmine-group'
  LIMIT 1
)
WHERE "companyAccountId" IS NULL;

UPDATE "WhatsAppMessage"
SET "companyAccountId" = (
  SELECT "id"
  FROM "CompanyAccount"
  WHERE "slug" = 'jasmine-group'
  LIMIT 1
)
WHERE "companyAccountId" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConfig_companyAccountId_key"
  ON "WhatsAppConfig"("companyAccountId");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppConfig_evolutionInstanceName_key"
  ON "WhatsAppConfig"("evolutionInstanceName");
CREATE INDEX IF NOT EXISTS "WhatsAppConfig_connectionStatus_updatedAt_idx"
  ON "WhatsAppConfig"("connectionStatus", "updatedAt");
CREATE INDEX IF NOT EXISTS "CustomerConversation_companyAccountId_isActive_updatedAt_idx"
  ON "CustomerConversation"("companyAccountId", "isActive", "updatedAt");
CREATE INDEX IF NOT EXISTS "CustomerConversation_companyAccountId_customerPhone_channel_idx"
  ON "CustomerConversation"("companyAccountId", "customerPhone", "channel");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppMessage_providerMessageId_key"
  ON "WhatsAppMessage"("providerMessageId");
CREATE INDEX IF NOT EXISTS "WhatsAppMessage_companyAccountId_phone_createdAt_idx"
  ON "WhatsAppMessage"("companyAccountId", "phone", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WhatsAppConfig_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppConfig"
      ADD CONSTRAINT "WhatsAppConfig_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CustomerConversation_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "CustomerConversation"
      ADD CONSTRAINT "CustomerConversation_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WhatsAppMessage_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppMessage"
      ADD CONSTRAINT "WhatsAppMessage_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "WhatsAppOutboxMessage" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "conversationId" TEXT,
  "listingId" TEXT,
  "toPhone" TEXT NOT NULL,
  "content" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'QUEUED',
  "idempotencyKey" TEXT NOT NULL,
  "providerMessageId" TEXT,
  "createdByType" TEXT,
  "createdById" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "deliveredAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "WhatsAppOutboxMessage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "WhatsAppOutboxMessage_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_idempotencyKey_key"
  ON "WhatsAppOutboxMessage"("idempotencyKey");
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_providerMessageId_key"
  ON "WhatsAppOutboxMessage"("providerMessageId");
CREATE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_status_nextAttemptAt_idx"
  ON "WhatsAppOutboxMessage"("status", "nextAttemptAt");
CREATE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_companyAccountId_createdAt_idx"
  ON "WhatsAppOutboxMessage"("companyAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_companyAccountId_toPhone_createdAt_idx"
  ON "WhatsAppOutboxMessage"("companyAccountId", "toPhone", "createdAt");
