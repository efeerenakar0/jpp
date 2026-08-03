-- Jasmine site delivery, publication gate and relational viewing workflow.
-- This repository executes deploy SQL on every Vercel build, so the entire
-- migration is guarded by an application-owned marker and runs atomically.

CREATE TABLE IF NOT EXISTS "_JasmineDeployMigration" (
  "name" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "_JasmineDeployMigration"
    WHERE "name" = '20260802233000_site_delivery_viewing_workflows'
  ) THEN
    RETURN;
  END IF;

  CREATE TYPE "WebsiteDeliveryStatus" AS ENUM (
    'SUBMITTED', 'IN_PROGRESS', 'READY_FOR_QA', 'CHANGES_REQUESTED',
    'APPROVED', 'DELIVERED', 'FAILED'
  );
  CREATE TYPE "WebsiteDeliveryType" AS ENUM (
    'ZIP_ONLY', 'ADMIN_DEPLOYED', 'CUSTOMER_DEPLOYS'
  );
  CREATE TYPE "WebsiteQaStatus" AS ENUM ('PENDING', 'PASSED', 'FAILED');
  CREATE TYPE "WebsiteApiKeyEnvironment" AS ENUM ('STAGING', 'PRODUCTION');
  CREATE TYPE "WebsiteApiKeyStatus" AS ENUM ('ACTIVE', 'REVOKED', 'EXPIRED');
  CREATE TYPE "AdPublicationStatus" AS ENUM (
    'DRAFT', 'READY_TO_PUBLISH', 'EXPORTED', 'MANUALLY_CONFIRMED'
  );
  CREATE TYPE "ViewingWorkflowStatus" AS ENUM (
    'AWAITING_ASSIGNMENT_SEND', 'AWAITING_EMPLOYEE_ACK',
    'ASSIGNMENT_ACCEPTED', 'AWAITING_OWNER_DECISION',
    'REASSIGNMENT_REQUIRED', 'APPOINTMENT_PENDING',
    'APPOINTMENT_CONFIRMED', 'AWAITING_APPOINTMENT_CONFIRMATION',
    'AWAITING_OUTCOME', 'SALE_REPORTED', 'AWAITING_SALE_DECISION',
    'COMPLETED', 'CANCELLED', 'FAILED'
  );
  CREATE TYPE "ViewingAssignmentAttemptStatus" AS ENUM (
    'AWAITING_SEND', 'AWAITING_ACK', 'ACCEPTED', 'REJECTED', 'TIMED_OUT',
    'DELIVERY_FAILED', 'SUPERSEDED'
  );
  CREATE TYPE "WhatsAppInteractionPromptStatus" AS ENUM (
    'OPEN', 'ANSWERED', 'EXPIRED', 'CANCELLED'
  );
  CREATE TYPE "WhatsAppInteractionPromptType" AS ENUM (
    'EMPLOYEE_ASSIGNMENT', 'OWNER_REASSIGNMENT',
    'EMPLOYEE_APPOINTMENT_CONFIRMATION', 'EMPLOYEE_APPOINTMENT_OUTCOME',
    'OWNER_SALE_DECISION', 'OWNER_APPOINTMENT_ESCALATION'
  );
  CREATE TYPE "WhatsAppExpectedResponseType" AS ENUM (
    'ASSIGNMENT_ACK', 'OWNER_REASSIGNMENT_DECISION',
    'APPOINTMENT_CONFIRMATION', 'APPOINTMENT_OUTCOME', 'SALE_DECISION'
  );
  CREATE TYPE "WhatsAppPromptRecipientType" AS ENUM ('OWNER', 'EMPLOYEE');
  CREATE TYPE "AppointmentOutcomeType" AS ENUM (
    'SOLD_REPORTED', 'NOT_SOLD', 'FOLLOW_UP', 'CUSTOMER_NO_SHOW',
    'EMPLOYEE_NO_SHOW', 'CANCELLED'
  );
  CREATE TYPE "AppointmentNoSaleReason" AS ENUM (
    'PRICE', 'PROPERTY_MISMATCH', 'FINANCING', 'TIMING',
    'CUSTOMER_DECISION', 'OTHER'
  );
  CREATE TYPE "SaleDecisionStatus" AS ENUM (
    'PENDING', 'REMOVE', 'KEEP', 'DETAIL_REQUESTED'
  );

  ALTER TABLE "CrmProperty"
    ADD COLUMN "authorityDocumentVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "authorityExpiresAt" TIMESTAMP(3),
    ADD COLUMN "eidsExemptionReason" TEXT,
    ADD COLUMN "eidsRequired" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "eidsVerificationReference" TEXT,
    ADD COLUMN "eidsVerifiedAt" TIMESTAMP(3),
    ADD COLUMN "publicationApprovedAt" TIMESTAMP(3),
    ADD COLUMN "publicationApprovedById" TEXT,
    ADD COLUMN "publicationAuthorizationDocumentId" TEXT,
    ADD COLUMN "publicationBlockReason" TEXT,
    ADD COLUMN "publicationBlockedAt" TIMESTAMP(3),
    ADD COLUMN "publishedAt" TIMESTAMP(3);

  ALTER TABLE "WebsiteIntegration"
    ADD COLUMN "approvedAt" TIMESTAMP(3),
    ADD COLUMN "approvedByAdminId" TEXT,
    ADD COLUMN "currentSourceVersion" INTEGER NOT NULL DEFAULT 1,
    ADD COLUMN "deliveryType" "WebsiteDeliveryType",
    ADD COLUMN "finalUrl" TEXT,
    ADD COLUMN "lastError" TEXT,
    ADD COLUMN "previewUrl" TEXT;
  ALTER TABLE "WebsiteIntegration" ALTER COLUMN "status" DROP DEFAULT;
  ALTER TABLE "WebsiteIntegration" ALTER COLUMN "status" TYPE "WebsiteDeliveryStatus"
    USING (
      CASE
        WHEN "status" IN ('IN_PROGRESS', 'READY_FOR_QA', 'CHANGES_REQUESTED',
          'APPROVED', 'DELIVERED', 'FAILED') THEN "status"
        ELSE 'SUBMITTED'
      END
    )::"WebsiteDeliveryStatus";
  ALTER TABLE "WebsiteIntegration" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

  ALTER TABLE "AdCampaign"
    ADD COLUMN "exportPackage" JSONB,
    ADD COLUMN "exportedAt" TIMESTAMP(3),
    ADD COLUMN "externalPublicationUrl" TEXT,
    ADD COLUMN "manuallyConfirmedAt" TIMESTAMP(3),
    ADD COLUMN "manuallyConfirmedById" TEXT,
    ADD COLUMN "publicationProofUrl" TEXT,
    ADD COLUMN "publicationStatus" "AdPublicationStatus" NOT NULL DEFAULT 'DRAFT';

  ALTER TABLE "AppointmentRequest"
    ADD COLUMN "companyAccountId" TEXT,
    ADD COLUMN "contactId" TEXT,
    ADD COLUMN "propertyId" TEXT,
    ADD COLUMN "assignedMemberId" TEXT,
    ADD COLUMN "taskId" TEXT,
    ADD COLUMN "dealId" TEXT,
    ADD COLUMN "viewingWorkflowId" TEXT,
    ADD COLUMN "shortCode" TEXT,
    ADD COLUMN "startAt" TIMESTAMP(3),
    ADD COLUMN "endAt" TIMESTAMP(3),
    ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul',
    ADD COLUMN "customerReminderSentAt" TIMESTAMP(3),
    ADD COLUMN "employeeReminderSentAt" TIMESTAMP(3),
    ADD COLUMN "employeeReminderCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "employeeConfirmationDueAt" TIMESTAMP(3),
    ADD COLUMN "employeeConfirmationEscalatedAt" TIMESTAMP(3),
    ADD COLUMN "employeeConfirmedAt" TIMESTAMP(3),
    ADD COLUMN "employeeDeclinedAt" TIMESTAMP(3),
    ADD COLUMN "outcomePromptSentAt" TIMESTAMP(3),
    ADD COLUMN "outcomeReminderCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "outcomeEscalatedAt" TIMESTAMP(3);

  UPDATE "AppointmentRequest" appointment
  SET "companyAccountId" = conversation."companyAccountId",
      "customerReminderSentAt" = appointment."reminderSentAt",
      "startAt" = COALESCE(
        appointment."startAt",
        CASE
          WHEN appointment."proposedDate" IS NOT NULL
            AND appointment."proposedTime" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
          THEN (
            appointment."proposedDate"::date
            + appointment."proposedTime"::time
          ) AT TIME ZONE 'Europe/Istanbul'
          ELSE appointment."proposedDate"
        END
      )
  FROM "CustomerConversation" conversation
  WHERE appointment."conversationId" = conversation."id"
    AND appointment."companyAccountId" IS NULL;

  IF EXISTS (
    SELECT 1 FROM "AppointmentRequest" WHERE "companyAccountId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'AppointmentRequest tenant backfill failed; orphan conversation must be repaired';
  END IF;
  ALTER TABLE "AppointmentRequest" ALTER COLUMN "companyAccountId" SET NOT NULL;
  UPDATE "AppointmentRequest"
  SET "endAt" = "startAt" + INTERVAL '1 hour'
  WHERE "startAt" IS NOT NULL AND "endAt" IS NULL;

  CREATE TABLE "WebsiteIntegrationVersion" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "websiteIntegrationId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "sourceBlobPathname" TEXT NOT NULL,
    "sourceFileName" TEXT NOT NULL,
    "sourceSize" INTEGER NOT NULL,
    "sourceSha256" TEXT NOT NULL,
    "sourceSecurityReport" JSONB NOT NULL,
    "workOrderVersion" INTEGER NOT NULL DEFAULT 1,
    "workOrder" TEXT NOT NULL,
    "resultBlobPathname" TEXT,
    "resultFileName" TEXT,
    "resultSize" INTEGER,
    "resultSha256" TEXT,
    "resultSecurityReport" JSONB,
    "buildReport" JSONB,
    "qaStatus" "WebsiteQaStatus" NOT NULL DEFAULT 'PENDING',
    "qaReport" JSONB,
    "previewUrl" TEXT,
    "finalUrl" TEXT,
    "deliveryType" "WebsiteDeliveryType",
    "submittedByType" TEXT NOT NULL,
    "submittedById" TEXT NOT NULL,
    "resultUploadedByAdminId" TEXT,
    "approvedByAdminId" TEXT,
    "resultUploadedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "retentionUntil" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebsiteIntegrationVersion_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "WebsiteIntegrationApiKey" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "websiteIntegrationId" TEXT NOT NULL,
    "environment" "WebsiteApiKeyEnvironment" NOT NULL,
    "status" "WebsiteApiKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "keyLookup" TEXT NOT NULL,
    "keyHint" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdByType" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteIntegrationApiKey_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "WebsiteDeliveryToken" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "websiteIntegrationId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "tokenHint" TEXT NOT NULL,
    "recipientEmail" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdByAdminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WebsiteDeliveryToken_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "ViewingWorkflow" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "crmTaskId" TEXT NOT NULL,
    "dealId" TEXT,
    "initialAppointmentRequestId" TEXT,
    "shortCode" TEXT NOT NULL,
    "status" "ViewingWorkflowStatus" NOT NULL DEFAULT 'AWAITING_ASSIGNMENT_SEND',
    "version" INTEGER NOT NULL DEFAULT 1,
    "idempotencyKey" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ViewingWorkflow_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "ViewingAssignmentAttempt" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "previousAttemptId" TEXT,
    "outboxMessageId" TEXT,
    "providerMessageId" TEXT,
    "responseProviderMessageId" TEXT,
    "status" "ViewingAssignmentAttemptStatus" NOT NULL DEFAULT 'AWAITING_SEND',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "ackDeadlineAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "failureReason" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ViewingAssignmentAttempt_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "WhatsAppInteractionPrompt" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "workflowId" TEXT,
    "taskId" TEXT,
    "propertyId" TEXT,
    "contactId" TEXT,
    "appointmentRequestId" TEXT,
    "assignmentAttemptId" TEXT,
    "actionId" TEXT,
    "recipientType" "WhatsAppPromptRecipientType" NOT NULL,
    "recipientId" TEXT NOT NULL,
    "recipientMemberId" TEXT,
    "promptType" "WhatsAppInteractionPromptType" NOT NULL,
    "expectedResponseType" "WhatsAppExpectedResponseType" NOT NULL,
    "shortCode" TEXT NOT NULL,
    "candidateMemberSnapshot" JSONB,
    "outboxMessageId" TEXT,
    "sentProviderMessageId" TEXT,
    "lastReplyProviderMessageId" TEXT,
    "status" "WhatsAppInteractionPromptStatus" NOT NULL DEFAULT 'OPEN',
    "deadlineAt" TIMESTAMP(3),
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "lastReminderAt" TIMESTAMP(3),
    "answeredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "idempotencyKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WhatsAppInteractionPrompt_pkey" PRIMARY KEY ("id")
  );

  CREATE TABLE "AppointmentOutcome" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "appointmentRequestId" TEXT NOT NULL,
    "viewingWorkflowId" TEXT,
    "reportedByMemberId" TEXT,
    "outcome" "AppointmentOutcomeType" NOT NULL,
    "noSaleReason" "AppointmentNoSaleReason",
    "reasonText" TEXT,
    "nextAction" TEXT,
    "nextActionAt" TIMESTAMP(3),
    "followUpTaskId" TEXT,
    "evidenceProviderMessageId" TEXT,
    "saleDecision" "SaleDecisionStatus",
    "saleDecisionById" TEXT,
    "saleDecisionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AppointmentOutcome_pkey" PRIMARY KEY ("id")
  );

  CREATE UNIQUE INDEX "WebsiteIntegrationVersion_websiteIntegrationId_version_key"
    ON "WebsiteIntegrationVersion"("websiteIntegrationId", "version");
  CREATE INDEX "WebsiteIntegrationVersion_companyAccountId_createdAt_idx"
    ON "WebsiteIntegrationVersion"("companyAccountId", "createdAt");
  CREATE INDEX "WebsiteIntegrationVersion_websiteIntegrationId_qaStatus_cre_idx"
    ON "WebsiteIntegrationVersion"("websiteIntegrationId", "qaStatus", "createdAt");
  CREATE UNIQUE INDEX "WebsiteIntegrationApiKey_keyLookup_key"
    ON "WebsiteIntegrationApiKey"("keyLookup");
  CREATE INDEX "WebsiteIntegrationApiKey_websiteIntegrationId_environment_s_idx"
    ON "WebsiteIntegrationApiKey"("websiteIntegrationId", "environment", "status");
  CREATE INDEX "WebsiteIntegrationApiKey_companyAccountId_createdAt_idx"
    ON "WebsiteIntegrationApiKey"("companyAccountId", "createdAt");
  CREATE UNIQUE INDEX "WebsiteDeliveryToken_tokenHash_key"
    ON "WebsiteDeliveryToken"("tokenHash");
  CREATE INDEX "WebsiteDeliveryToken_companyAccountId_expiresAt_idx"
    ON "WebsiteDeliveryToken"("companyAccountId", "expiresAt");
  CREATE INDEX "WebsiteDeliveryToken_websiteIntegrationId_versionId_idx"
    ON "WebsiteDeliveryToken"("websiteIntegrationId", "versionId");

  CREATE UNIQUE INDEX "ViewingWorkflow_crmTaskId_key"
    ON "ViewingWorkflow"("crmTaskId");
  CREATE UNIQUE INDEX "ViewingWorkflow_companyAccountId_idempotencyKey_key"
    ON "ViewingWorkflow"("companyAccountId", "idempotencyKey");
  CREATE UNIQUE INDEX "ViewingWorkflow_companyAccountId_shortCode_key"
    ON "ViewingWorkflow"("companyAccountId", "shortCode");
  CREATE INDEX "ViewingWorkflow_companyAccountId_status_updatedAt_idx"
    ON "ViewingWorkflow"("companyAccountId", "status", "updatedAt");
  CREATE INDEX "ViewingWorkflow_contactId_propertyId_idx"
    ON "ViewingWorkflow"("contactId", "propertyId");

  CREATE UNIQUE INDEX "ViewingAssignmentAttempt_outboxMessageId_key"
    ON "ViewingAssignmentAttempt"("outboxMessageId");
  CREATE UNIQUE INDEX "ViewingAssignmentAttempt_workflowId_sequence_key"
    ON "ViewingAssignmentAttempt"("workflowId", "sequence");
  CREATE UNIQUE INDEX "ViewingAssignmentAttempt_companyAccountId_idempotencyKey_key"
    ON "ViewingAssignmentAttempt"("companyAccountId", "idempotencyKey");
  CREATE INDEX "ViewingAssignmentAttempt_companyAccountId_status_ackDeadlin_idx"
    ON "ViewingAssignmentAttempt"("companyAccountId", "status", "ackDeadlineAt");
  CREATE INDEX "ViewingAssignmentAttempt_memberId_status_idx"
    ON "ViewingAssignmentAttempt"("memberId", "status");

  CREATE UNIQUE INDEX "WhatsAppInteractionPrompt_outboxMessageId_key"
    ON "WhatsAppInteractionPrompt"("outboxMessageId");
  CREATE UNIQUE INDEX "WhatsAppInteractionPrompt_companyAccountId_idempotencyKey_key"
    ON "WhatsAppInteractionPrompt"("companyAccountId", "idempotencyKey");
  CREATE UNIQUE INDEX "WhatsAppInteractionPrompt_companyAccountId_lastReplyProvide_key"
    ON "WhatsAppInteractionPrompt"("companyAccountId", "lastReplyProviderMessageId");
  CREATE INDEX "WhatsAppInteractionPrompt_companyAccountId_recipientType_re_idx"
    ON "WhatsAppInteractionPrompt"("companyAccountId", "recipientType", "recipientId", "status");
  CREATE INDEX "WhatsAppInteractionPrompt_recipientMemberId_status_idx"
    ON "WhatsAppInteractionPrompt"("recipientMemberId", "status");
  CREATE INDEX "WhatsAppInteractionPrompt_companyAccountId_shortCode_status_idx"
    ON "WhatsAppInteractionPrompt"("companyAccountId", "shortCode", "status");
  CREATE INDEX "WhatsAppInteractionPrompt_assignmentAttemptId_status_idx"
    ON "WhatsAppInteractionPrompt"("assignmentAttemptId", "status");
  CREATE INDEX "WhatsAppInteractionPrompt_sentProviderMessageId_idx"
    ON "WhatsAppInteractionPrompt"("sentProviderMessageId");
  CREATE INDEX "WhatsAppInteractionPrompt_deadlineAt_status_idx"
    ON "WhatsAppInteractionPrompt"("deadlineAt", "status");

  CREATE UNIQUE INDEX "AppointmentOutcome_appointmentRequestId_key"
    ON "AppointmentOutcome"("appointmentRequestId");
  CREATE INDEX "AppointmentOutcome_companyAccountId_outcome_createdAt_idx"
    ON "AppointmentOutcome"("companyAccountId", "outcome", "createdAt");
  CREATE INDEX "AppointmentOutcome_viewingWorkflowId_idx"
    ON "AppointmentOutcome"("viewingWorkflowId");

  CREATE INDEX "CrmProperty_companyAccountId_status_publicationApprovedAt_idx"
    ON "CrmProperty"("companyAccountId", "status", "publicationApprovedAt");
  CREATE INDEX "CrmProperty_publicationAuthorizationDocumentId_idx"
    ON "CrmProperty"("publicationAuthorizationDocumentId");
  CREATE INDEX "AppointmentRequest_companyAccountId_status_startAt_idx"
    ON "AppointmentRequest"("companyAccountId", "status", "startAt");
  CREATE INDEX "AppointmentRequest_assignedMemberId_startAt_idx"
    ON "AppointmentRequest"("assignedMemberId", "startAt");
  CREATE INDEX "AppointmentRequest_viewingWorkflowId_idx"
    ON "AppointmentRequest"("viewingWorkflowId");
  CREATE UNIQUE INDEX "AppointmentRequest_companyAccountId_shortCode_key"
    ON "AppointmentRequest"("companyAccountId", "shortCode");

  ALTER TABLE "CrmProperty" ADD CONSTRAINT
    "CrmProperty_publicationAuthorizationDocumentId_fkey"
    FOREIGN KEY ("publicationAuthorizationDocumentId") REFERENCES "CompanyDocument"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "WebsiteIntegrationVersion" ADD CONSTRAINT
    "WebsiteIntegrationVersion_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WebsiteIntegrationVersion" ADD CONSTRAINT
    "WebsiteIntegrationVersion_websiteIntegrationId_fkey"
    FOREIGN KEY ("websiteIntegrationId") REFERENCES "WebsiteIntegration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WebsiteIntegrationApiKey" ADD CONSTRAINT
    "WebsiteIntegrationApiKey_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WebsiteIntegrationApiKey" ADD CONSTRAINT
    "WebsiteIntegrationApiKey_websiteIntegrationId_fkey"
    FOREIGN KEY ("websiteIntegrationId") REFERENCES "WebsiteIntegration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WebsiteDeliveryToken" ADD CONSTRAINT
    "WebsiteDeliveryToken_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WebsiteDeliveryToken" ADD CONSTRAINT
    "WebsiteDeliveryToken_websiteIntegrationId_fkey"
    FOREIGN KEY ("websiteIntegrationId") REFERENCES "WebsiteIntegration"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WebsiteDeliveryToken" ADD CONSTRAINT
    "WebsiteDeliveryToken_versionId_fkey"
    FOREIGN KEY ("versionId") REFERENCES "WebsiteIntegrationVersion"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

  ALTER TABLE "ViewingWorkflow" ADD CONSTRAINT "ViewingWorkflow_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "ViewingWorkflow" ADD CONSTRAINT "ViewingWorkflow_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "ViewingWorkflow" ADD CONSTRAINT "ViewingWorkflow_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "ViewingWorkflow" ADD CONSTRAINT "ViewingWorkflow_conversationId_fkey"
    FOREIGN KEY ("conversationId") REFERENCES "CustomerConversation"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "ViewingWorkflow" ADD CONSTRAINT "ViewingWorkflow_crmTaskId_fkey"
    FOREIGN KEY ("crmTaskId") REFERENCES "CrmTask"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "ViewingWorkflow" ADD CONSTRAINT "ViewingWorkflow_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "ViewingAssignmentAttempt" ADD CONSTRAINT
    "ViewingAssignmentAttempt_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "ViewingAssignmentAttempt" ADD CONSTRAINT
    "ViewingAssignmentAttempt_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "ViewingWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "ViewingAssignmentAttempt" ADD CONSTRAINT
    "ViewingAssignmentAttempt_memberId_fkey"
    FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  ALTER TABLE "ViewingAssignmentAttempt" ADD CONSTRAINT
    "ViewingAssignmentAttempt_outboxMessageId_fkey"
    FOREIGN KEY ("outboxMessageId") REFERENCES "WhatsAppOutboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "WhatsAppInteractionPrompt" ADD CONSTRAINT
    "WhatsAppInteractionPrompt_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WhatsAppInteractionPrompt" ADD CONSTRAINT
    "WhatsAppInteractionPrompt_workflowId_fkey"
    FOREIGN KEY ("workflowId") REFERENCES "ViewingWorkflow"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WhatsAppInteractionPrompt" ADD CONSTRAINT
    "WhatsAppInteractionPrompt_appointmentRequestId_fkey"
    FOREIGN KEY ("appointmentRequestId") REFERENCES "AppointmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WhatsAppInteractionPrompt" ADD CONSTRAINT
    "WhatsAppInteractionPrompt_assignmentAttemptId_fkey"
    FOREIGN KEY ("assignmentAttemptId") REFERENCES "ViewingAssignmentAttempt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WhatsAppInteractionPrompt" ADD CONSTRAINT
    "WhatsAppInteractionPrompt_recipientMemberId_fkey"
    FOREIGN KEY ("recipientMemberId") REFERENCES "CompanyMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "WhatsAppInteractionPrompt" ADD CONSTRAINT
    "WhatsAppInteractionPrompt_outboxMessageId_fkey"
    FOREIGN KEY ("outboxMessageId") REFERENCES "WhatsAppOutboxMessage"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_assignedMemberId_fkey"
    FOREIGN KEY ("assignedMemberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_taskId_fkey"
    FOREIGN KEY ("taskId") REFERENCES "CrmTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "AppointmentRequest" ADD CONSTRAINT "AppointmentRequest_viewingWorkflowId_fkey"
    FOREIGN KEY ("viewingWorkflowId") REFERENCES "ViewingWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  ALTER TABLE "AppointmentOutcome" ADD CONSTRAINT "AppointmentOutcome_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "AppointmentOutcome" ADD CONSTRAINT "AppointmentOutcome_appointmentRequestId_fkey"
    FOREIGN KEY ("appointmentRequestId") REFERENCES "AppointmentRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  ALTER TABLE "AppointmentOutcome" ADD CONSTRAINT "AppointmentOutcome_viewingWorkflowId_fkey"
    FOREIGN KEY ("viewingWorkflowId") REFERENCES "ViewingWorkflow"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "AppointmentOutcome" ADD CONSTRAINT "AppointmentOutcome_reportedByMemberId_fkey"
    FOREIGN KEY ("reportedByMemberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  ALTER TABLE "AppointmentOutcome" ADD CONSTRAINT "AppointmentOutcome_followUpTaskId_fkey"
    FOREIGN KEY ("followUpTaskId") REFERENCES "CrmTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

  INSERT INTO "_JasmineDeployMigration" ("name")
  VALUES ('20260802233000_site_delivery_viewing_workflows');
END
$migration$;
