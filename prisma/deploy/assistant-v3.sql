DO $$ BEGIN
  CREATE TYPE "MessageDeliveryStatus" AS ENUM (
    'NOT_APPLICABLE',
    'RECEIVED',
    'QUEUED',
    'SENT',
    'DELIVERED',
    'READ',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TYPE "AppointmentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "CustomerConversation"
  ADD COLUMN IF NOT EXISTS "notes" TEXT,
  ADD COLUMN IF NOT EXISTS "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "lastCustomerMessageAt" TIMESTAMP(3);

ALTER TABLE "ConversationMessage"
  ADD COLUMN IF NOT EXISTS "providerMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "deliveryStatus" "MessageDeliveryStatus" NOT NULL DEFAULT 'NOT_APPLICABLE',
  ADD COLUMN IF NOT EXISTS "messageType" TEXT NOT NULL DEFAULT 'TEXT',
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "errorMessage" TEXT;

ALTER TABLE "AppointmentRequest"
  ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "rescheduledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);

ALTER TABLE "WhatsAppConfig"
  ADD COLUMN IF NOT EXISTS "fallbackTemplateName" TEXT,
  ADD COLUMN IF NOT EXISTS "templateLanguage" TEXT DEFAULT 'tr';

UPDATE "CustomerConversation" AS conversation
SET "lastCustomerMessageAt" = latest."createdAt"
FROM (
  SELECT DISTINCT ON ("conversationId")
    "conversationId",
    "createdAt"
  FROM "ConversationMessage"
  WHERE "role" = 'customer'
  ORDER BY "conversationId", "createdAt" DESC
) AS latest
WHERE conversation."id" = latest."conversationId"
  AND conversation."lastCustomerMessageAt" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationMessage_providerMessageId_key"
  ON "ConversationMessage"("providerMessageId");

CREATE INDEX IF NOT EXISTS "ConversationMessage_conversationId_createdAt_idx"
  ON "ConversationMessage"("conversationId", "createdAt");

CREATE INDEX IF NOT EXISTS "ConversationMessage_deliveryStatus_idx"
  ON "ConversationMessage"("deliveryStatus");

CREATE INDEX IF NOT EXISTS "AppointmentRequest_status_proposedDate_idx"
  ON "AppointmentRequest"("status", "proposedDate");
