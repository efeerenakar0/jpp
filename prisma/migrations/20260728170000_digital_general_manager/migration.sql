-- Dijital Genel Mudur foundation.
-- This migration is deliberately additive and re-runnable on PostgreSQL.

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

DO $migration$
BEGIN
  CREATE TYPE "PhoneVerificationStatus" AS ENUM (
    'UNVERIFIED',
    'VERIFIED',
    'CONFLICT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "MemberAvailability" AS ENUM (
    'AVAILABLE',
    'BUSY',
    'ON_LEAVE',
    'OFFLINE'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "OperationalTaskStatus" AS ENUM (
    'CREATED',
    'ASSIGNED',
    'MESSAGE_QUEUED',
    'DELIVERED',
    'ACCEPTED',
    'IN_PROGRESS',
    'WAITING_CUSTOMER',
    'APPOINTMENT_PROPOSED',
    'APPOINTMENT_CONFIRMED',
    'COMPLETED',
    'REJECTED',
    'REASSIGNMENT_REQUIRED',
    'CANCELLED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "OperationEventType" AS ENUM (
    'HOT_LEAD_DETECTED',
    'LISTING_FOUND',
    'AUTHORIZATION_INTEREST',
    'AUTHORIZATION_CONFIRMED',
    'VIEWING_REQUESTED',
    'TASK_ASSIGNED',
    'TASK_ACCEPTED',
    'TASK_REJECTED',
    'CUSTOMER_CONTACTED',
    'CUSTOMER_UNREACHABLE',
    'APPOINTMENT_PROPOSED',
    'APPOINTMENT_CONFIRMED',
    'COMMITMENT_CREATED',
    'COMMITMENT_OVERDUE',
    'HANDOFF_REQUESTED',
    'HANDOFF_ACCEPTED',
    'MESSAGE_DELIVERY_FAILED',
    'CORRECTION_RECEIVED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "GeneralManagerActionType" AS ENUM (
    'CREATE_TASK',
    'ASSIGN_EMPLOYEE',
    'REASSIGN_EMPLOYEE',
    'UPDATE_TASK_STATUS',
    'CREATE_COMMITMENT',
    'CREATE_CRM_ACTIVITY',
    'UPDATE_LEAD_STAGE',
    'SEND_EMPLOYEE_WHATSAPP',
    'NOTIFY_OWNER',
    'OFFER_CONVERSATION_HANDOFF',
    'SCHEDULE_APPOINTMENT',
    'ASK_CLARIFICATION',
    'CREATE_POLICY',
    'NO_ACTION'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

ALTER TYPE "GeneralManagerActionType"
  ADD VALUE IF NOT EXISTS 'CREATE_POLICY';

DO $migration$
BEGIN
  CREATE TYPE "GeneralManagerActionStatus" AS ENUM (
    'PROPOSED',
    'PENDING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'EXECUTING',
    'EXECUTED',
    'FAILED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "ActionApprovalDecision" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "ManagerRiskLevel" AS ENUM (
    'LOW',
    'MEDIUM',
    'HIGH',
    'CRITICAL'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "ManagerAutonomyMode" AS ENUM (
    'SUGGEST_ONLY',
    'APPROVAL_REQUIRED',
    'AUTO_LOW_RISK'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "CommitmentStatus" AS ENUM (
    'OPEN',
    'COMPLETED',
    'OVERDUE',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "ConversationHandoffStatus" AS ENUM (
    'PROPOSED',
    'REQUESTED',
    'ACCEPTED',
    'ACTIVE',
    'RETURNED',
    'REJECTED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "WhatsAppRecipientType" AS ENUM (
    'OWNER',
    'EMPLOYEE',
    'CRM_CONTACT',
    'PROPERTY_OWNER',
    'UNKNOWN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "DeliveryAuditStatus" AS ENUM (
    'QUEUED',
    'SENDING',
    'SENT',
    'DELIVERED',
    'READ',
    'RECEIVED',
    'FAILED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "ManagerPolicyScope" AS ENUM (
    'ONE_TIME',
    'CONVERSATION',
    'TEMPORARY',
    'PERMANENT'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

DO $migration$
BEGIN
  CREATE TYPE "ManagerPolicyStatus" AS ENUM (
    'ACTIVE',
    'EXPIRED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$migration$;

-- ---------------------------------------------------------------------------
-- Existing table expansion
-- ---------------------------------------------------------------------------

ALTER TABLE "CompanyAccount"
  ADD COLUMN IF NOT EXISTS "ownerPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerPhoneNormalized" TEXT,
  ADD COLUMN IF NOT EXISTS "ownerPhoneVerificationStatus"
    "PhoneVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "ownerPhoneVerifiedAt" TIMESTAMP(3);

ALTER TABLE "CompanyMember"
  ADD COLUMN IF NOT EXISTS "phoneNormalized" TEXT,
  ADD COLUMN IF NOT EXISTS "phoneVerificationStatus"
    "PhoneVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "canReceiveWhatsAppTasks" BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS "allowAutomaticInternalMessages" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS "preferredLanguage" TEXT NOT NULL DEFAULT 'tr',
  ADD COLUMN IF NOT EXISTS "workHours" JSONB,
  ADD COLUMN IF NOT EXISTS "availability"
    "MemberAvailability" NOT NULL DEFAULT 'AVAILABLE',
  ADD COLUMN IF NOT EXISTS "specialtyRegions" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN IF NOT EXISTS "maxActiveTaskCapacity" INTEGER NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS "lastAssignedAt" TIMESTAMP(3);

ALTER TABLE "CrmContact"
  ADD COLUMN IF NOT EXISTS "phoneNormalized" TEXT;

ALTER TABLE "CrmTask"
  ADD COLUMN IF NOT EXISTS "workflowStatus"
    "OperationalTaskStatus" NOT NULL DEFAULT 'CREATED',
  ADD COLUMN IF NOT EXISTS "workflowVersion" INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS "originEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceConversationId" TEXT,
  ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT,
  ADD COLUMN IF NOT EXISTS "assignmentReason" TEXT,
  ADD COLUMN IF NOT EXISTS "assignedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "messageQueuedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lastStatusAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "failureCode" TEXT,
  ADD COLUMN IF NOT EXISTS "failureReason" TEXT;

ALTER TABLE "HuntedListing"
  ADD COLUMN IF NOT EXISTS "ownerPhoneNormalized" TEXT;

ALTER TABLE "GeneralManagerMessage"
  ADD COLUMN IF NOT EXISTS "clientRequestId" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

ALTER TABLE "WhatsAppOutboxMessage"
  ADD COLUMN IF NOT EXISTS "contactId" TEXT,
  ADD COLUMN IF NOT EXISTS "propertyId" TEXT,
  ADD COLUMN IF NOT EXISTS "recipientType"
    "WhatsAppRecipientType" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "recipientId" TEXT,
  ADD COLUMN IF NOT EXISTS "purpose" TEXT,
  ADD COLUMN IF NOT EXISTS "relatedTaskId" TEXT,
  ADD COLUMN IF NOT EXISTS "operationEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "managerActionId" TEXT,
  ADD COLUMN IF NOT EXISTS "correlationId" TEXT,
  ADD COLUMN IF NOT EXISTS "replyToProviderMessageId" TEXT,
  ADD COLUMN IF NOT EXISTS "metadata" JSONB;

-- ---------------------------------------------------------------------------
-- New operational tables
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS "IdentityLink" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "phoneNormalized" TEXT NOT NULL,
  "role" "WhatsAppRecipientType" NOT NULL,
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "source" TEXT NOT NULL,
  "verified" BOOLEAN NOT NULL DEFAULT FALSE,
  "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "evidence" JSONB,
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "IdentityLink_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "IdentityLink_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "IdentityLink_confidence_check"
    CHECK ("confidence" >= 0 AND "confidence" <= 1)
);

CREATE TABLE IF NOT EXISTS "OperationEvent" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "eventType" "OperationEventType" NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "actorType" TEXT,
  "actorId" TEXT,
  "contactId" TEXT,
  "propertyId" TEXT,
  "listingId" TEXT,
  "taskId" TEXT,
  "conversationId" TEXT,
  "sourceProvider" TEXT,
  "sourceMessageId" TEXT,
  "metadata" JSONB,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationEvent_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "GeneralManagerAction" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "operationEventId" TEXT,
  "triggerMessageId" TEXT,
  "taskId" TEXT,
  "actionType" "GeneralManagerActionType" NOT NULL,
  "targetType" TEXT,
  "targetId" TEXT,
  "reason" TEXT NOT NULL,
  "evidence" JSONB,
  "confidence" DOUBLE PRECISION NOT NULL,
  "riskLevel" "ManagerRiskLevel" NOT NULL,
  "requiresApproval" BOOLEAN NOT NULL DEFAULT TRUE,
  "policyDecision" TEXT NOT NULL,
  "payload" JSONB,
  "proposedMessage" TEXT,
  "status" "GeneralManagerActionStatus" NOT NULL DEFAULT 'PROPOSED',
  "idempotencyKey" TEXT NOT NULL,
  "provider" TEXT,
  "model" TEXT,
  "requestedByType" TEXT,
  "requestedById" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "approvedAt" TIMESTAMP(3),
  "executedAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "GeneralManagerAction_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "GeneralManagerAction_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "GeneralManagerAction_operationEventId_fkey"
    FOREIGN KEY ("operationEventId") REFERENCES "OperationEvent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "GeneralManagerAction_confidence_check"
    CHECK ("confidence" >= 0 AND "confidence" <= 1)
);

CREATE TABLE IF NOT EXISTS "ActionApproval" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "actionId" TEXT NOT NULL,
  "decision" "ActionApprovalDecision" NOT NULL DEFAULT 'PENDING',
  "decidedByType" TEXT,
  "decidedById" TEXT,
  "decisionReason" TEXT,
  "editedPayload" JSONB,
  "decidedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ActionApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ActionApproval_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ActionApproval_actionId_fkey"
    FOREIGN KEY ("actionId") REFERENCES "GeneralManagerAction"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "TaskStatusTransition" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "taskId" TEXT NOT NULL,
  "fromStatus" "OperationalTaskStatus" NOT NULL,
  "toStatus" "OperationalTaskStatus" NOT NULL,
  "operationEventId" TEXT,
  "managerActionId" TEXT,
  "sourceMessageId" TEXT,
  "actorType" TEXT,
  "actorId" TEXT,
  "evidence" JSONB,
  "reason" TEXT,
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "TaskStatusTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "TaskStatusTransition_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskStatusTransition_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "TaskStatusTransition_operationEventId_fkey"
    FOREIGN KEY ("operationEventId") REFERENCES "OperationEvent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "TaskStatusTransition_managerActionId_fkey"
    FOREIGN KEY ("managerActionId") REFERENCES "GeneralManagerAction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "OperationalCommitment" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "taskId" TEXT,
  "memberId" TEXT,
  "contactId" TEXT,
  "propertyId" TEXT,
  "operationEventId" TEXT,
  "managerActionId" TEXT,
  "description" TEXT NOT NULL,
  "sourceMessageId" TEXT,
  "relativeTimeText" TEXT,
  "dueAt" TIMESTAMP(3),
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  "certainty" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status" "CommitmentStatus" NOT NULL DEFAULT 'OPEN',
  "reminderCount" INTEGER NOT NULL DEFAULT 0,
  "lastReminderAt" TIMESTAMP(3),
  "escalatedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "OperationalCommitment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "OperationalCommitment_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "OperationalCommitment_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OperationalCommitment_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OperationalCommitment_operationEventId_fkey"
    FOREIGN KEY ("operationEventId") REFERENCES "OperationEvent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OperationalCommitment_managerActionId_fkey"
    FOREIGN KEY ("managerActionId") REFERENCES "GeneralManagerAction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "OperationalCommitment_certainty_check"
    CHECK ("certainty" >= 0 AND "certainty" <= 1),
  CONSTRAINT "OperationalCommitment_reminderCount_check"
    CHECK ("reminderCount" >= 0)
);

CREATE TABLE IF NOT EXISTS "ConversationHandoff" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "conversationId" TEXT NOT NULL,
  "managerActionId" TEXT,
  "requestedByType" TEXT,
  "requestedById" TEXT,
  "assignedMemberId" TEXT,
  "status" "ConversationHandoffStatus" NOT NULL DEFAULT 'PROPOSED',
  "summary" TEXT,
  "verifiedContext" JSONB,
  "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "returnedAt" TIMESTAMP(3),
  "idempotencyKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ConversationHandoff_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ConversationHandoff_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationHandoff_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "CustomerConversation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ConversationHandoff_managerActionId_fkey"
    FOREIGN KEY ("managerActionId") REFERENCES "GeneralManagerAction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "MessageDeliveryAudit" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "outboxMessageId" TEXT NOT NULL,
  "status" "DeliveryAuditStatus" NOT NULL,
  "providerMessageId" TEXT,
  "rawStatus" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "MessageDeliveryAudit_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "MessageDeliveryAudit_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "MessageDeliveryAudit_outboxMessageId_fkey"
    FOREIGN KEY ("outboxMessageId") REFERENCES "WhatsAppOutboxMessage"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ManagerNotificationPreference" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "ownerPhone" TEXT,
  "ownerPhoneNormalized" TEXT,
  "ownerPhoneVerificationStatus"
    "PhoneVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "ownerPhoneVerifiedAt" TIMESTAMP(3),
  "notifyCriticalImmediately" BOOLEAN NOT NULL DEFAULT TRUE,
  "notifyTaskAccepted" BOOLEAN NOT NULL DEFAULT FALSE,
  "notifyOnlyProblemsAndDelays" BOOLEAN NOT NULL DEFAULT TRUE,
  "alwaysNotifyHotLeads" BOOLEAN NOT NULL DEFAULT TRUE,
  "hourlySummaryEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "morningSummaryEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "eveningSummaryEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "quietHoursStart" TEXT NOT NULL DEFAULT '22:00',
  "quietHoursEnd" TEXT NOT NULL DEFAULT '08:00',
  "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
  "autonomyMode" "ManagerAutonomyMode" NOT NULL DEFAULT 'SUGGEST_ONLY',
  "allowAutomaticEmployeeAssignment" BOOLEAN NOT NULL DEFAULT FALSE,
  "allowAutomaticEmployeeWhatsApp" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ManagerNotificationPreference_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManagerNotificationPreference_companyAccountId_key"
    UNIQUE ("companyAccountId"),
  CONSTRAINT "ManagerNotificationPreference_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ManagerPolicy" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "scope" "ManagerPolicyScope" NOT NULL,
  "status" "ManagerPolicyStatus" NOT NULL DEFAULT 'ACTIVE',
  "ruleType" TEXT NOT NULL,
  "rulePayload" JSONB NOT NULL,
  "conversationId" TEXT,
  "sourceMessageId" TEXT,
  "sourceActionId" TEXT,
  "createdByType" TEXT NOT NULL,
  "createdById" TEXT,
  "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ManagerPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManagerPolicy_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ManagerAuditLog" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "operationEventId" TEXT,
  "managerActionId" TEXT,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT,
  "operation" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "verifiedContext" JSONB,
  "evidence" JSONB,
  "structuredAi" JSONB,
  "confidence" DOUBLE PRECISION,
  "policyDecision" TEXT,
  "result" TEXT NOT NULL,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "correctionOfId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completedAt" TIMESTAMP(3),

  CONSTRAINT "ManagerAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ManagerAuditLog_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ManagerAuditLog_operationEventId_fkey"
    FOREIGN KEY ("operationEventId") REFERENCES "OperationEvent"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ManagerAuditLog_managerActionId_fkey"
    FOREIGN KEY ("managerActionId") REFERENCES "GeneralManagerAction"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ManagerAuditLog_correctionOfId_fkey"
    FOREIGN KEY ("correctionOfId") REFERENCES "ManagerAuditLog"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "ManagerAuditLog_confidence_check"
    CHECK ("confidence" IS NULL OR ("confidence" >= 0 AND "confidence" <= 1))
);

CREATE TABLE IF NOT EXISTS "DailyManagerSummary" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "periodStart" TIMESTAMP(3) NOT NULL,
  "periodEnd" TIMESTAMP(3) NOT NULL,
  "facts" JSONB NOT NULL,
  "evidenceIds" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "selectionReason" TEXT,
  "generatedText" TEXT NOT NULL,
  "generatedBy" TEXT NOT NULL DEFAULT 'RULE_ENGINE',
  "generatedModel" TEXT,
  "deliveryStatus" TEXT NOT NULL DEFAULT 'NOT_REQUESTED',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "DailyManagerSummary_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DailyManagerSummary_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DailyManagerSummary_period_check"
    CHECK ("periodEnd" > "periodStart")
);

-- The outbox existed before OperationEvent and GeneralManagerAction, so its
-- new foreign keys are attached only after both target tables exist.
DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WhatsAppOutboxMessage_operationEventId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppOutboxMessage"
      ADD CONSTRAINT "WhatsAppOutboxMessage_operationEventId_fkey"
      FOREIGN KEY ("operationEventId") REFERENCES "OperationEvent"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WhatsAppOutboxMessage_managerActionId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppOutboxMessage"
      ADD CONSTRAINT "WhatsAppOutboxMessage_managerActionId_fkey"
      FOREIGN KEY ("managerActionId") REFERENCES "GeneralManagerAction"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$migration$;

-- ---------------------------------------------------------------------------
-- Safe E.164 backfill
-- ---------------------------------------------------------------------------

-- The helper intentionally normalizes only unambiguous numbers. Unknown
-- national formats remain NULL and therefore stay UNVERIFIED.
CREATE OR REPLACE FUNCTION "_jasmine_normalize_e164"(input_phone TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
AS $normalizer$
DECLARE
  digits TEXT;
BEGIN
  IF input_phone IS NULL OR btrim(input_phone) = '' THEN
    RETURN NULL;
  END IF;

  digits := regexp_replace(input_phone, '[^0-9]', '', 'g');

  IF digits = '' THEN
    RETURN NULL;
  END IF;

  IF btrim(input_phone) LIKE '+%'
     AND length(digits) BETWEEN 8 AND 15 THEN
    RETURN '+' || digits;
  END IF;

  IF digits LIKE '00%' THEN
    digits := substring(digits FROM 3);
    IF length(digits) BETWEEN 8 AND 15 THEN
      RETURN '+' || digits;
    END IF;
    RETURN NULL;
  END IF;

  IF length(digits) = 12 AND digits LIKE '90%' THEN
    RETURN '+' || digits;
  END IF;

  IF length(digits) = 11 AND digits LIKE '05%' THEN
    RETURN '+90' || substring(digits FROM 2);
  END IF;

  IF length(digits) = 10 AND digits LIKE '5%' THEN
    RETURN '+90' || digits;
  END IF;

  RETURN NULL;
END
$normalizer$;

UPDATE "CompanyAccount"
SET "ownerPhoneNormalized" = "_jasmine_normalize_e164"("ownerPhone")
WHERE "ownerPhoneNormalized" IS NULL
  AND "ownerPhone" IS NOT NULL;

UPDATE "CompanyMember"
SET "phoneNormalized" = "_jasmine_normalize_e164"("phone")
WHERE "phoneNormalized" IS NULL
  AND "phone" IS NOT NULL;

UPDATE "CrmContact"
SET "phoneNormalized" = "_jasmine_normalize_e164"("phone")
WHERE "phoneNormalized" IS NULL
  AND "phone" IS NOT NULL;

UPDATE "HuntedListing"
SET "ownerPhoneNormalized" = "_jasmine_normalize_e164"("ownerPhone")
WHERE "ownerPhoneNormalized" IS NULL
  AND "ownerPhone" IS NOT NULL;

-- Two active employees may not retain the same routable identity. Preserve
-- their raw phone values for manual correction, mark both records CONFLICT,
-- and remove only the normalized routing value.
WITH duplicate_active_phones AS (
  SELECT "companyAccountId", "phoneNormalized"
  FROM "CompanyMember"
  WHERE "active" = TRUE
    AND "phoneNormalized" IS NOT NULL
  GROUP BY "companyAccountId", "phoneNormalized"
  HAVING count(*) > 1
)
UPDATE "CompanyMember" AS member
SET
  "phoneVerificationStatus" = 'CONFLICT',
  "phoneVerifiedAt" = NULL,
  "phoneNormalized" = NULL
FROM duplicate_active_phones AS duplicate_phone
WHERE member."companyAccountId" = duplicate_phone."companyAccountId"
  AND member."phoneNormalized" = duplicate_phone."phoneNormalized"
  AND member."active" = TRUE;

-- A company's own connected WhatsApp endpoint cannot be an employee routing
-- target. As above, keep the raw number and require manual correction.
WITH connected_numbers AS (
  SELECT
    "companyAccountId",
    "_jasmine_normalize_e164"("connectedPhone") AS "phoneNormalized"
  FROM "WhatsAppConfig"
  WHERE "companyAccountId" IS NOT NULL
    AND "connectedPhone" IS NOT NULL
)
UPDATE "CompanyMember" AS member
SET
  "phoneVerificationStatus" = 'CONFLICT',
  "phoneVerifiedAt" = NULL,
  "phoneNormalized" = NULL
FROM connected_numbers AS connected
WHERE member."companyAccountId" = connected."companyAccountId"
  AND member."phoneNormalized" = connected."phoneNormalized"
  AND connected."phoneNormalized" IS NOT NULL;

-- Avoid a self-notification loop when the owner notification number is the
-- same endpoint as the company's connected WhatsApp account.
WITH connected_numbers AS (
  SELECT
    "companyAccountId",
    "_jasmine_normalize_e164"("connectedPhone") AS "phoneNormalized"
  FROM "WhatsAppConfig"
  WHERE "companyAccountId" IS NOT NULL
    AND "connectedPhone" IS NOT NULL
)
UPDATE "CompanyAccount" AS account
SET
  "ownerPhoneVerificationStatus" = 'CONFLICT',
  "ownerPhoneVerifiedAt" = NULL,
  "ownerPhoneNormalized" = NULL
FROM connected_numbers AS connected
WHERE account."id" = connected."companyAccountId"
  AND account."ownerPhoneNormalized" = connected."phoneNormalized"
  AND connected."phoneNormalized" IS NOT NULL;

-- Existing calendar tasks retain their legacy status while receiving the new
-- operational workflow projection.
UPDATE "CrmTask"
SET
  "workflowStatus" = CASE
    WHEN "status"::TEXT = 'COMPLETED'
      THEN 'COMPLETED'::"OperationalTaskStatus"
    WHEN "status"::TEXT = 'CANCELLED'
      THEN 'CANCELLED'::"OperationalTaskStatus"
    WHEN "assignedMemberId" IS NOT NULL
      THEN 'ASSIGNED'::"OperationalTaskStatus"
    ELSE 'CREATED'::"OperationalTaskStatus"
  END,
  "assignedAt" = CASE
    WHEN "assignedMemberId" IS NOT NULL
      THEN COALESCE("assignedAt", "createdAt")
    ELSE "assignedAt"
  END,
  "lastStatusAt" = COALESCE(
    "lastStatusAt",
    "completedAt",
    "updatedAt",
    "createdAt"
  );

-- Every company starts in the safest mode. Existing preference rows are never
-- overwritten when the migration is re-run.
INSERT INTO "ManagerNotificationPreference" (
  "id",
  "companyAccountId",
  "ownerPhone",
  "ownerPhoneNormalized",
  "ownerPhoneVerificationStatus",
  "ownerPhoneVerifiedAt",
  "autonomyMode",
  "createdAt",
  "updatedAt"
)
SELECT
  'mnp_' || md5('manager-preference:' || account."id"),
  account."id",
  account."ownerPhone",
  account."ownerPhoneNormalized",
  account."ownerPhoneVerificationStatus",
  account."ownerPhoneVerifiedAt",
  'SUGGEST_ONLY'::"ManagerAutonomyMode",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "CompanyAccount" AS account
ON CONFLICT ("companyAccountId") DO NOTHING;

DROP FUNCTION IF EXISTS "_jasmine_normalize_e164"(TEXT);

-- ---------------------------------------------------------------------------
-- Constraints and indexes
-- ---------------------------------------------------------------------------

DO $migration$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'CompanyMember_maxActiveTaskCapacity_check'
  ) THEN
    ALTER TABLE "CompanyMember"
      ADD CONSTRAINT "CompanyMember_maxActiveTaskCapacity_check"
      CHECK ("maxActiveTaskCapacity" >= 0);
  END IF;
END
$migration$;

CREATE INDEX IF NOT EXISTS "CompanyMember_companyAccountId_phoneNormalized_idx"
  ON "CompanyMember"("companyAccountId", "phoneNormalized");

CREATE INDEX IF NOT EXISTS "CompanyMember_companyAccountId_availability_active_idx"
  ON "CompanyMember"("companyAccountId", "availability", "active");

-- Conflicting legacy rows were removed from normalized routing above. This
-- partial unique index prevents any future duplicate among active employees
-- while still allowing inactive historical records to retain their number.
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMember_active_phoneNormalized_key"
  ON "CompanyMember"("companyAccountId", "phoneNormalized")
  WHERE "active" = TRUE AND "phoneNormalized" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "CrmTask_companyAccountId_idempotencyKey_key"
  ON "CrmTask"("companyAccountId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "CrmTask_companyAccountId_workflowStatus_dueAt_idx"
  ON "CrmTask"("companyAccountId", "workflowStatus", "dueAt");

CREATE UNIQUE INDEX IF NOT EXISTS "GeneralManagerMessage_companyAccountId_clientRequestId_key"
  ON "GeneralManagerMessage"("companyAccountId", "clientRequestId");

-- Expand from the old globally unique key to tenant-scoped idempotency.
CREATE UNIQUE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_companyAccountId_idempotencyKey_key"
  ON "WhatsAppOutboxMessage"("companyAccountId", "idempotencyKey");

ALTER TABLE "WhatsAppOutboxMessage"
  DROP CONSTRAINT IF EXISTS "WhatsAppOutboxMessage_idempotencyKey_key";

DROP INDEX IF EXISTS "WhatsAppOutboxMessage_idempotencyKey_key";

CREATE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_companyAccountId_recipientType_recipi_idx"
  ON "WhatsAppOutboxMessage"("companyAccountId", "recipientType", "recipientId");

CREATE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_operationEventId_idx"
  ON "WhatsAppOutboxMessage"("operationEventId");

CREATE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_managerActionId_idx"
  ON "WhatsAppOutboxMessage"("managerActionId");

CREATE UNIQUE INDEX IF NOT EXISTS "IdentityLink_companyAccountId_phoneNormalized_role_entityId_key"
  ON "IdentityLink"("companyAccountId", "phoneNormalized", "role", "entityId");

CREATE INDEX IF NOT EXISTS "IdentityLink_companyAccountId_phoneNormalized_active_idx"
  ON "IdentityLink"("companyAccountId", "phoneNormalized", "active");

CREATE INDEX IF NOT EXISTS "IdentityLink_companyAccountId_entityType_entityId_idx"
  ON "IdentityLink"("companyAccountId", "entityType", "entityId");

CREATE UNIQUE INDEX IF NOT EXISTS "OperationEvent_companyAccountId_idempotencyKey_key"
  ON "OperationEvent"("companyAccountId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "OperationEvent_companyAccountId_eventType_occurredAt_idx"
  ON "OperationEvent"("companyAccountId", "eventType", "occurredAt");

CREATE INDEX IF NOT EXISTS "OperationEvent_companyAccountId_entityType_entityId_idx"
  ON "OperationEvent"("companyAccountId", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "OperationEvent_companyAccountId_sourceMessageId_idx"
  ON "OperationEvent"("companyAccountId", "sourceMessageId");

CREATE UNIQUE INDEX IF NOT EXISTS "GeneralManagerAction_companyAccountId_idempotencyKey_key"
  ON "GeneralManagerAction"("companyAccountId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "GeneralManagerAction_companyAccountId_status_createdAt_idx"
  ON "GeneralManagerAction"("companyAccountId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "GeneralManagerAction_companyAccountId_actionType_createdAt_idx"
  ON "GeneralManagerAction"("companyAccountId", "actionType", "createdAt");

CREATE INDEX IF NOT EXISTS "GeneralManagerAction_operationEventId_idx"
  ON "GeneralManagerAction"("operationEventId");

CREATE UNIQUE INDEX IF NOT EXISTS "ActionApproval_actionId_key"
  ON "ActionApproval"("actionId");

CREATE INDEX IF NOT EXISTS "ActionApproval_companyAccountId_decision_createdAt_idx"
  ON "ActionApproval"("companyAccountId", "decision", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "TaskStatusTransition_companyAccountId_idempotencyKey_key"
  ON "TaskStatusTransition"("companyAccountId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "TaskStatusTransition_companyAccountId_taskId_createdAt_idx"
  ON "TaskStatusTransition"("companyAccountId", "taskId", "createdAt");

CREATE UNIQUE INDEX IF NOT EXISTS "OperationalCommitment_companyAccountId_idempotencyKey_key"
  ON "OperationalCommitment"("companyAccountId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "OperationalCommitment_companyAccountId_status_dueAt_idx"
  ON "OperationalCommitment"("companyAccountId", "status", "dueAt");

CREATE INDEX IF NOT EXISTS "OperationalCommitment_memberId_status_idx"
  ON "OperationalCommitment"("memberId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "ConversationHandoff_companyAccountId_idempotencyKey_key"
  ON "ConversationHandoff"("companyAccountId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "ConversationHandoff_companyAccountId_status_createdAt_idx"
  ON "ConversationHandoff"("companyAccountId", "status", "createdAt");

CREATE INDEX IF NOT EXISTS "ConversationHandoff_conversationId_status_idx"
  ON "ConversationHandoff"("conversationId", "status");

CREATE UNIQUE INDEX IF NOT EXISTS "MessageDeliveryAudit_companyAccountId_idempotencyKey_key"
  ON "MessageDeliveryAudit"("companyAccountId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "MessageDeliveryAudit_companyAccountId_status_occurredAt_idx"
  ON "MessageDeliveryAudit"("companyAccountId", "status", "occurredAt");

CREATE INDEX IF NOT EXISTS "MessageDeliveryAudit_outboxMessageId_occurredAt_idx"
  ON "MessageDeliveryAudit"("outboxMessageId", "occurredAt");

CREATE UNIQUE INDEX IF NOT EXISTS "ManagerNotificationPreference_companyAccountId_key"
  ON "ManagerNotificationPreference"("companyAccountId");

CREATE INDEX IF NOT EXISTS "ManagerPolicy_companyAccountId_status_effectiveFrom_expires_idx"
  ON "ManagerPolicy"(
    "companyAccountId",
    "status",
    "effectiveFrom",
    "expiresAt"
  );

CREATE INDEX IF NOT EXISTS "ManagerPolicy_companyAccountId_conversationId_status_idx"
  ON "ManagerPolicy"("companyAccountId", "conversationId", "status");

CREATE INDEX IF NOT EXISTS "ManagerAuditLog_companyAccountId_createdAt_idx"
  ON "ManagerAuditLog"("companyAccountId", "createdAt");

CREATE INDEX IF NOT EXISTS "ManagerAuditLog_companyAccountId_entityType_entityId_idx"
  ON "ManagerAuditLog"("companyAccountId", "entityType", "entityId");

CREATE INDEX IF NOT EXISTS "ManagerAuditLog_operationEventId_idx"
  ON "ManagerAuditLog"("operationEventId");

CREATE INDEX IF NOT EXISTS "ManagerAuditLog_managerActionId_idx"
  ON "ManagerAuditLog"("managerActionId");

CREATE UNIQUE INDEX IF NOT EXISTS "DailyManagerSummary_companyAccountId_periodStart_periodEnd_key"
  ON "DailyManagerSummary"("companyAccountId", "periodStart", "periodEnd");

CREATE INDEX IF NOT EXISTS "DailyManagerSummary_companyAccountId_periodStart_idx"
  ON "DailyManagerSummary"("companyAccountId", "periodStart");

-- Resumable/idempotent Dijital Genel Müdür request processing.
ALTER TABLE "GeneralManagerMessage"
  ADD COLUMN IF NOT EXISTS "processingStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingError" TEXT,
  ADD COLUMN IF NOT EXISTS "structuredPlan" JSONB,
  ADD COLUMN IF NOT EXISTS "processingProvider" TEXT,
  ADD COLUMN IF NOT EXISTS "processingModel" TEXT;

CREATE INDEX IF NOT EXISTS "GeneralManagerMessage_companyAccountId_processingStatus_cre_idx"
  ON "GeneralManagerMessage"("companyAccountId", "processingStatus", "createdAt");

CREATE TABLE IF NOT EXISTS "PhoneVerificationChallenge" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "subjectType" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "phoneNormalized" TEXT NOT NULL,
  "codeHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "maxAttempts" INTEGER NOT NULL DEFAULT 5,
  "sentAt" TIMESTAMP(3),
  "consumedAt" TIMESTAMP(3),
  "createdByType" TEXT NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PhoneVerificationChallenge_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'PhoneVerificationChallenge_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "PhoneVerificationChallenge"
      ADD CONSTRAINT "PhoneVerificationChallenge_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId")
      REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "PhoneVerificationChallenge_companyAccountId_subjectType_sub_idx"
  ON "PhoneVerificationChallenge"("companyAccountId", "subjectType", "subjectId", "createdAt");

CREATE INDEX IF NOT EXISTS "PhoneVerificationChallenge_companyAccountId_phoneNormalized_idx"
  ON "PhoneVerificationChallenge"("companyAccountId", "phoneNormalized", "consumedAt", "expiresAt");

ALTER TABLE "GeneralManagerAction"
  ADD COLUMN IF NOT EXISTS "executionStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "executionAttemptCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "ConversationMessage"
  ADD COLUMN IF NOT EXISTS "processingStatus" TEXT NOT NULL DEFAULT 'COMPLETED',
  ADD COLUMN IF NOT EXISTS "processingStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "processingError" TEXT,
  ADD COLUMN IF NOT EXISTS "processingAttemptCount" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "ConversationMessage_processingStatus_createdAt_idx"
  ON "ConversationMessage"("processingStatus", "createdAt");

-- Durable provider ACK inbox. Delivery callbacks may arrive before the
-- dispatch transaction has stored providerMessageId on the outbox row.
CREATE TABLE IF NOT EXISTS "WhatsAppDeliveryReceipt" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "provider" TEXT NOT NULL,
  "providerMessageId" TEXT NOT NULL,
  "status" "DeliveryAuditStatus" NOT NULL,
  "rawStatus" TEXT,
  "errorCode" TEXT,
  "errorMessage" TEXT,
  "metadata" JSONB,
  "idempotencyKey" TEXT NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WhatsAppDeliveryReceipt_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'WhatsAppDeliveryReceipt_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "WhatsAppDeliveryReceipt"
      ADD CONSTRAINT "WhatsAppDeliveryReceipt_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId")
      REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE
      ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "WaDeliveryReceipt_tenant_idempotency_key"
  ON "WhatsAppDeliveryReceipt"("companyAccountId", "idempotencyKey");

CREATE INDEX IF NOT EXISTS "WaDeliveryReceipt_pending_idx"
  ON "WhatsAppDeliveryReceipt"(
    "companyAccountId",
    "provider",
    "providerMessageId",
    "processedAt"
  );
