-- Global Partner Network. The deploy chain executes this file on every build,
-- therefore the application-owned marker keeps the migration atomic/idempotent.

CREATE TABLE IF NOT EXISTS "_JasmineDeployMigration" (
  "name" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $migration$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "_JasmineDeployMigration"
    WHERE "name" = '20260803120000_partner_network'
  ) THEN
    RETURN;
  END IF;

  CREATE TYPE "PartnerPipelineStage" AS ENUM ('DISCOVERED','QUALIFIED','CONTACTED','ENGAGED','MEETING','REVIEW','AGREEMENT','ACTIVE','DISQUALIFIED','NOT_INTERESTED','DO_NOT_CONTACT','ARCHIVED');
  CREATE TYPE "PartnerSourceType" AS ENUM ('OFFICIAL_REGISTRY','PROFESSIONAL_ASSOCIATION','AUTHORIZED_DIRECTORY_API','PARTNER_FEED','MANUAL_CSV','FIRST_PARTY_APPLICATION','OFFICIAL_COMPANY_WEBSITE');
  CREATE TYPE "PartnerDiscoveryRunStatus" AS ENUM ('QUEUED','RUNNING','COMPLETED','PARTIAL','FAILED');
  CREATE TYPE "PartnerContactVerificationStatus" AS ENUM ('UNVERIFIED','SOURCE_VERIFIED','MANUALLY_VERIFIED','REJECTED');
  CREATE TYPE "PartnerMailboxStatus" AS ENUM ('CONNECTED','ERROR','REVOKED');
  CREATE TYPE "PartnerEmailDraftStatus" AS ENUM ('DRAFT','READY_FOR_APPROVAL','APPROVED','INVALIDATED','QUEUED','SENT','CANCELLED');
  CREATE TYPE "PartnerApprovalStatus" AS ENUM ('APPROVED','REVOKED','CONSUMED');
  CREATE TYPE "PartnerEmailMessageStatus" AS ENUM ('QUEUED','SENDING','SENT','RETRY','FAILED','CANCELLED','EXTERNAL_COMPOSE_OPENED');
  CREATE TYPE "PartnerEmailEventType" AS ENUM ('QUEUED','CLAIMED','SENT','RETRY_SCHEDULED','FAILED','CANCELLED','MANUALLY_CONFIRMED','BOUNCED','SUPPRESSED');
  CREATE TYPE "PartnerCountryPolicyStatus" AS ENUM ('ALLOWED','CONSENT_REQUIRED','MANUAL_REVIEW','BLOCKED','BLOCKED_PENDING_COUNTRY_REVIEW');
  CREATE TYPE "PartnerAgreementStatus" AS ENUM ('DRAFT','SENT_FOR_REVIEW','SIGNED','EXPIRED','TERMINATED');
  CREATE TYPE "PartnerCommissionStatus" AS ENUM ('PROPOSED','APPROVED','EARNED','PAID','CANCELLED');

  CREATE TABLE "PartnerOrganization" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "externalId" TEXT,
    "legalName" TEXT NOT NULL, "displayName" TEXT NOT NULL, "normalizedName" TEXT NOT NULL,
    "domain" TEXT, "websiteUrl" TEXT, "logoUrl" TEXT, "countryCode" TEXT NOT NULL,
    "countryName" TEXT NOT NULL, "city" TEXT, "address" TEXT, "registrationNumber" TEXT,
    "licenseNumber" TEXT, "licenseVerifiedAt" TIMESTAMP(3), "legalStatus" TEXT,
    "languages" TEXT[] DEFAULT ARRAY[]::TEXT[], "specialties" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "internationalExperience" BOOLEAN NOT NULL DEFAULT false, "reviewAverage" DOUBLE PRECISION,
    "reviewCount" INTEGER, "fitScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0, "scoreVersion" TEXT NOT NULL DEFAULT 'partner-score-v1',
    "scoreExplanation" JSONB, "stage" "PartnerPipelineStage" NOT NULL DEFAULT 'DISCOVERED',
    "statusReason" TEXT, "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastEnrichedAt" TIMESTAMP(3), "lastVerifiedAt" TIMESTAMP(3), "lastContactedAt" TIMESTAMP(3),
    "nextFollowUpAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
  );

  CREATE TABLE "PartnerDiscoveryRun" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "providerKey" TEXT NOT NULL,
    "countryCode" TEXT NOT NULL, "city" TEXT, "language" TEXT, "specialization" TEXT,
    "status" "PartnerDiscoveryRunStatus" NOT NULL DEFAULT 'QUEUED', "requestedLimit" INTEGER NOT NULL DEFAULT 25,
    "discoveredCount" INTEGER NOT NULL DEFAULT 0, "acceptedCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0, "errorCode" TEXT, "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3), "completedAt" TIMESTAMP(3), "createdByType" TEXT NOT NULL,
    "createdById" TEXT NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL
  );

  CREATE TABLE "PartnerSource" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT,
    "discoveryRunId" TEXT, "type" "PartnerSourceType" NOT NULL, "providerKey" TEXT NOT NULL,
    "externalId" TEXT, "sourceUrl" TEXT, "title" TEXT, "evidence" JSONB NOT NULL,
    "contentHash" TEXT NOT NULL, "observedAt" TIMESTAMP(3) NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "expiresAt" TIMESTAMP(3),
    "trusted" BOOLEAN NOT NULL DEFAULT false, "promptInjectionRisk" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE "PartnerContact" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CORPORATE', "name" TEXT, "encryptedEmail" TEXT,
    "emailHmac" TEXT, "emailMasked" TEXT, "emailDomain" TEXT, "encryptedPhone" TEXT, "phoneMasked" TEXT,
    "verificationStatus" "PartnerContactVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "verifiedAt" TIMESTAMP(3), "sourceId" TEXT, "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
  );

  CREATE TABLE "PartnerScoreSnapshot" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
    "version" TEXT NOT NULL, "total" DOUBLE PRECISION NOT NULL, "confidence" DOUBLE PRECISION NOT NULL,
    "breakdown" JSONB NOT NULL, "explanations" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "evidenceSourceIds" TEXT[] DEFAULT ARRAY[]::TEXT[], "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE "PartnerMailboxConnection" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL UNIQUE,
    "status" "PartnerMailboxStatus" NOT NULL DEFAULT 'CONNECTED', "email" TEXT NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL, "encryptedAccessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3), "grantedScopes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "connectedById" TEXT NOT NULL, "lastTestedAt" TIMESTAMP(3), "lastSuccessfulSendAt" TIMESTAMP(3),
    "lastErrorCode" TEXT, "lastErrorAt" TIMESTAMP(3), "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
  );

  CREATE TABLE "PartnerEmailDraft" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL, "status" "PartnerEmailDraftStatus" NOT NULL DEFAULT 'DRAFT',
    "subject" TEXT NOT NULL, "body" TEXT NOT NULL, "language" TEXT NOT NULL,
    "turkishTranslation" TEXT NOT NULL, "personalizationEvidence" JSONB NOT NULL,
    "warnings" TEXT[] DEFAULT ARRAY[]::TEXT[], "contentHash" TEXT NOT NULL, "promptVersion" TEXT NOT NULL,
    "modelProvider" TEXT NOT NULL, "modelName" TEXT, "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "editedAt" TIMESTAMP(3), "editedByType" TEXT, "editedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
  );

  CREATE TABLE "PartnerOutreachApproval" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "draftId" TEXT NOT NULL,
    "status" "PartnerApprovalStatus" NOT NULL DEFAULT 'APPROVED', "approvedHash" TEXT NOT NULL,
    "policySnapshot" JSONB NOT NULL, "approvedByType" TEXT NOT NULL, "approvedById" TEXT NOT NULL,
    "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "revokedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE "PartnerEmailMessage" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL, "draftId" TEXT NOT NULL, "approvalId" TEXT UNIQUE,
    "mailboxConnectionId" TEXT NOT NULL, "idempotencyKey" TEXT NOT NULL,
    "status" "PartnerEmailMessageStatus" NOT NULL DEFAULT 'QUEUED', "recipientEmailHmac" TEXT NOT NULL,
    "recipientEmailMasked" TEXT NOT NULL, "recipientDomain" TEXT NOT NULL, "subjectSnapshot" TEXT NOT NULL,
    "bodySnapshot" TEXT NOT NULL, "scheduledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "claimedAt" TIMESTAMP(3), "leaseExpiresAt" TIMESTAMP(3), "leaseToken" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0, "maxAttempts" INTEGER NOT NULL DEFAULT 5,
    "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "providerMessageId" TEXT,
    "providerThreadId" TEXT, "sentAt" TIMESTAMP(3), "failedAt" TIMESTAMP(3),
    "lastErrorCode" TEXT, "lastErrorMessage" TEXT, "followUpNumber" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    UNIQUE ("companyAccountId", "idempotencyKey")
  );

  CREATE TABLE "PartnerEmailEvent" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "messageId" TEXT NOT NULL,
    "type" "PartnerEmailEventType" NOT NULL, "providerEventId" TEXT, "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("companyAccountId", "providerEventId")
  );

  CREATE TABLE "PartnerSuppression" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT, "contactId" TEXT,
    "emailHmac" TEXT NOT NULL, "emailMasked" TEXT NOT NULL, "reason" TEXT NOT NULL, "source" TEXT NOT NULL,
    "suppressedByType" TEXT NOT NULL, "suppressedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ("companyAccountId", "emailHmac")
  );

  CREATE TABLE "PartnerActivity" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
    "type" TEXT NOT NULL, "actorType" TEXT NOT NULL, "actorId" TEXT, "summary" TEXT NOT NULL,
    "metadata" JSONB, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE "PartnerAgreement" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
    "status" "PartnerAgreementStatus" NOT NULL DEFAULT 'DRAFT', "title" TEXT NOT NULL, "terms" JSONB NOT NULL,
    "startsAt" TIMESTAMP(3), "endsAt" TIMESTAMP(3), "signedAt" TIMESTAMP(3), "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
  );

  CREATE TABLE "PartnerCommission" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "organizationId" TEXT NOT NULL,
    "agreementId" TEXT, "status" "PartnerCommissionStatus" NOT NULL DEFAULT 'PROPOSED',
    "currency" TEXT NOT NULL DEFAULT 'EUR', "amount" DOUBLE PRECISION, "rate" DOUBLE PRECISION,
    "reference" TEXT, "notes" TEXT, "earnedAt" TIMESTAMP(3), "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL
  );

  CREATE TABLE "PartnerCountryPolicy" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "countryCode" TEXT NOT NULL,
    "status" "PartnerCountryPolicyStatus" NOT NULL DEFAULT 'BLOCKED_PENDING_COUNTRY_REVIEW',
    "legalBasisNote" TEXT, "consentRequired" BOOLEAN NOT NULL DEFAULT false, "footerText" TEXT,
    "dailyCompanyLimit" INTEGER NOT NULL DEFAULT 25, "dailyDomainLimit" INTEGER NOT NULL DEFAULT 3,
    "dailyMailboxLimit" INTEGER NOT NULL DEFAULT 25, "reviewedByType" TEXT, "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3), "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL, UNIQUE ("companyAccountId", "countryCode")
  );

  CREATE TABLE "PartnerEmailQuotaBucket" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "mailboxId" TEXT NOT NULL,
    "recipientDomain" TEXT NOT NULL, "localDate" TEXT NOT NULL, "companyCount" INTEGER NOT NULL DEFAULT 0,
    "mailboxCount" INTEGER NOT NULL DEFAULT 0, "domainCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
    UNIQUE ("companyAccountId", "mailboxId", "recipientDomain", "localDate")
  );

  CREATE TABLE "PartnerApplicationAttempt" (
    "id" TEXT PRIMARY KEY, "companyAccountId" TEXT NOT NULL, "fingerprintHmac" TEXT NOT NULL,
    "emailHmac" TEXT NOT NULL, "accepted" BOOLEAN NOT NULL, "reasonCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX "PartnerOrganization_company_country_stage_score_idx" ON "PartnerOrganization"("companyAccountId","countryCode","stage","fitScore");
  CREATE INDEX "PartnerOrganization_company_name_city_idx" ON "PartnerOrganization"("companyAccountId","normalizedName","city");
  CREATE UNIQUE INDEX "PartnerOrganization_company_domain_key" ON "PartnerOrganization"("companyAccountId","domain");
  CREATE UNIQUE INDEX "PartnerContact_company_email_key" ON "PartnerContact"("companyAccountId","emailHmac");
  CREATE INDEX "PartnerContact_company_org_active_idx" ON "PartnerContact"("companyAccountId","organizationId","active");
  CREATE UNIQUE INDEX "PartnerSource_company_provider_hash_key" ON "PartnerSource"("companyAccountId","providerKey","contentHash");
  CREATE INDEX "PartnerDiscoveryRun_company_status_created_idx" ON "PartnerDiscoveryRun"("companyAccountId","status","createdAt");
  CREATE INDEX "PartnerScoreSnapshot_company_org_date_idx" ON "PartnerScoreSnapshot"("companyAccountId","organizationId","calculatedAt");
  CREATE INDEX "PartnerEmailDraft_company_status_created_idx" ON "PartnerEmailDraft"("companyAccountId","status","createdAt");
  CREATE INDEX "PartnerEmailMessage_worker_idx" ON "PartnerEmailMessage"("status","nextAttemptAt","leaseExpiresAt");
  CREATE INDEX "PartnerEmailMessage_company_domain_created_idx" ON "PartnerEmailMessage"("companyAccountId","recipientDomain","createdAt");
  CREATE INDEX "PartnerActivity_company_org_created_idx" ON "PartnerActivity"("companyAccountId","organizationId","createdAt");
  CREATE INDEX "PartnerCountryPolicy_company_status_idx" ON "PartnerCountryPolicy"("companyAccountId","status");
  CREATE INDEX "PartnerApplicationAttempt_rate_idx" ON "PartnerApplicationAttempt"("companyAccountId","fingerprintHmac","createdAt");

  ALTER TABLE "PartnerOrganization" ADD CONSTRAINT "PartnerOrganization_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerDiscoveryRun" ADD CONSTRAINT "PartnerDiscoveryRun_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerSource" ADD CONSTRAINT "PartnerSource_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerSource" ADD CONSTRAINT "PartnerSource_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerSource" ADD CONSTRAINT "PartnerSource_run_fkey" FOREIGN KEY ("discoveryRunId") REFERENCES "PartnerDiscoveryRun"("id") ON DELETE SET NULL;
  ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerContact" ADD CONSTRAINT "PartnerContact_source_fkey" FOREIGN KEY ("sourceId") REFERENCES "PartnerSource"("id") ON DELETE SET NULL;
  ALTER TABLE "PartnerScoreSnapshot" ADD CONSTRAINT "PartnerScore_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerScoreSnapshot" ADD CONSTRAINT "PartnerScore_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerMailboxConnection" ADD CONSTRAINT "PartnerMailbox_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerEmailDraft" ADD CONSTRAINT "PartnerDraft_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerEmailDraft" ADD CONSTRAINT "PartnerDraft_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerEmailDraft" ADD CONSTRAINT "PartnerDraft_contact_fkey" FOREIGN KEY ("contactId") REFERENCES "PartnerContact"("id") ON DELETE RESTRICT;
  ALTER TABLE "PartnerOutreachApproval" ADD CONSTRAINT "PartnerApproval_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerOutreachApproval" ADD CONSTRAINT "PartnerApproval_draft_fkey" FOREIGN KEY ("draftId") REFERENCES "PartnerEmailDraft"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerEmailMessage" ADD CONSTRAINT "PartnerMessage_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerEmailMessage" ADD CONSTRAINT "PartnerMessage_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerEmailMessage" ADD CONSTRAINT "PartnerMessage_contact_fkey" FOREIGN KEY ("contactId") REFERENCES "PartnerContact"("id") ON DELETE RESTRICT;
  ALTER TABLE "PartnerEmailMessage" ADD CONSTRAINT "PartnerMessage_draft_fkey" FOREIGN KEY ("draftId") REFERENCES "PartnerEmailDraft"("id") ON DELETE RESTRICT;
  ALTER TABLE "PartnerEmailMessage" ADD CONSTRAINT "PartnerMessage_approval_fkey" FOREIGN KEY ("approvalId") REFERENCES "PartnerOutreachApproval"("id") ON DELETE SET NULL;
  ALTER TABLE "PartnerEmailMessage" ADD CONSTRAINT "PartnerMessage_mailbox_fkey" FOREIGN KEY ("mailboxConnectionId") REFERENCES "PartnerMailboxConnection"("id") ON DELETE RESTRICT;
  ALTER TABLE "PartnerEmailEvent" ADD CONSTRAINT "PartnerEvent_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerEmailEvent" ADD CONSTRAINT "PartnerEvent_message_fkey" FOREIGN KEY ("messageId") REFERENCES "PartnerEmailMessage"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerSuppression" ADD CONSTRAINT "PartnerSuppression_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerSuppression" ADD CONSTRAINT "PartnerSuppression_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE SET NULL;
  ALTER TABLE "PartnerSuppression" ADD CONSTRAINT "PartnerSuppression_contact_fkey" FOREIGN KEY ("contactId") REFERENCES "PartnerContact"("id") ON DELETE SET NULL;
  ALTER TABLE "PartnerActivity" ADD CONSTRAINT "PartnerActivity_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerActivity" ADD CONSTRAINT "PartnerActivity_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerAgreement" ADD CONSTRAINT "PartnerAgreement_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerAgreement" ADD CONSTRAINT "PartnerAgreement_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_org_fkey" FOREIGN KEY ("organizationId") REFERENCES "PartnerOrganization"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerCommission" ADD CONSTRAINT "PartnerCommission_agreement_fkey" FOREIGN KEY ("agreementId") REFERENCES "PartnerAgreement"("id") ON DELETE SET NULL;
  ALTER TABLE "PartnerCountryPolicy" ADD CONSTRAINT "PartnerPolicy_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerEmailQuotaBucket" ADD CONSTRAINT "PartnerQuota_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  ALTER TABLE "PartnerApplicationAttempt" ADD CONSTRAINT "PartnerApplication_company_fkey" FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;

  INSERT INTO "_JasmineDeployMigration" ("name")
  VALUES ('20260803120000_partner_network');
END $migration$;
