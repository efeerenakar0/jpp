-- Explicitly authorized cross-company portfolio pool and tenant-scoped deed workflow.
-- Safe to execute on every Vercel build through the shared deployment marker.

CREATE TABLE IF NOT EXISTS "_JasmineDeployMigration" (
  "name" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('20260805220000_authorized_pool_deed_tracking'));

  IF EXISTS (
    SELECT 1 FROM "_JasmineDeployMigration"
    WHERE "name" = '20260805220000_authorized_pool_deed_tracking'
  ) THEN
    RETURN;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PortfolioPoolShareStatus') THEN
    CREATE TYPE "PortfolioPoolShareStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'REVOKED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PortfolioPoolContactRequestStatus') THEN
    CREATE TYPE "PortfolioPoolContactRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeedCaseType') THEN
    CREATE TYPE "DeedCaseType" AS ENUM ('SALE', 'PURCHASE', 'MORTGAGE', 'INHERITANCE', 'CORRECTION', 'OTHER');
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DeedCaseStatus') THEN
    CREATE TYPE "DeedCaseStatus" AS ENUM ('DRAFT', 'PREPARING', 'DOCUMENTS_MISSING', 'READY_FOR_APPOINTMENT', 'APPOINTMENT_SCHEDULED', 'COMPLETED', 'CANCELLED');
  END IF;

  ALTER TABLE "CrmProperty" ADD COLUMN IF NOT EXISTS "propertyType" TEXT;

  CREATE TABLE IF NOT EXISTS "PortfolioPoolShare" (
    "id" TEXT PRIMARY KEY,
    "ownerCompanyAccountId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "status" "PortfolioPoolShareStatus" NOT NULL DEFAULT 'ACTIVE',
    "sharePermissionGrantedAt" TIMESTAMP(3) NOT NULL,
    "permissionReference" TEXT,
    "authorityExpiresAt" TIMESTAMP(3) NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "pausedAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,
    "createdByPrincipalType" TEXT NOT NULL,
    "createdByPrincipalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "PortfolioPoolContactRequest" (
    "id" TEXT PRIMARY KEY,
    "shareId" TEXT NOT NULL,
    "requesterCompanyAccountId" TEXT NOT NULL,
    "ownerCompanyAccountId" TEXT NOT NULL,
    "status" "PortfolioPoolContactRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" TEXT,
    "decisionNote" TEXT,
    "decidedAt" TIMESTAMP(3),
    "decidedByPrincipalType" TEXT,
    "decidedByPrincipalId" TEXT,
    "idempotencyKey" TEXT NOT NULL,
    "createdByPrincipalType" TEXT NOT NULL,
    "createdByPrincipalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "DeedTrackingCase" (
    "id" TEXT PRIMARY KEY,
    "companyAccountId" TEXT NOT NULL,
    "propertyId" TEXT,
    "contactId" TEXT,
    "assignedMemberId" TEXT,
    "type" "DeedCaseType" NOT NULL,
    "status" "DeedCaseStatus" NOT NULL DEFAULT 'DRAFT',
    "title" TEXT NOT NULL,
    "checklist" JSONB NOT NULL,
    "appointmentAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "officialReference" TEXT,
    "officialIntegration" TEXT DEFAULT 'NOT_CONNECTED',
    "humanApprovalRequired" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdByPrincipalType" TEXT NOT NULL,
    "createdByPrincipalId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "DeedTrackingEvent" (
    "id" TEXT PRIMARY KEY,
    "companyAccountId" TEXT NOT NULL,
    "deedTrackingCaseId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "metadata" JSONB,
    "actorPrincipalType" TEXT NOT NULL,
    "actorPrincipalId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioPoolShare_owner_property_key"
    ON "PortfolioPoolShare"("ownerCompanyAccountId", "propertyId");
  CREATE INDEX IF NOT EXISTS "PortfolioPoolShare_status_expiry_idx"
    ON "PortfolioPoolShare"("status", "authorityExpiresAt");
  CREATE INDEX IF NOT EXISTS "PortfolioPoolShare_property_status_idx"
    ON "PortfolioPoolShare"("propertyId", "status");
  CREATE UNIQUE INDEX IF NOT EXISTS "PortfolioPoolContactRequest_requester_idempotency_key"
    ON "PortfolioPoolContactRequest"("requesterCompanyAccountId", "idempotencyKey");
  CREATE INDEX IF NOT EXISTS "PortfolioPoolContactRequest_requester_status_idx"
    ON "PortfolioPoolContactRequest"("requesterCompanyAccountId", "status", "createdAt");
  CREATE INDEX IF NOT EXISTS "PortfolioPoolContactRequest_owner_status_idx"
    ON "PortfolioPoolContactRequest"("ownerCompanyAccountId", "status", "createdAt");
  CREATE INDEX IF NOT EXISTS "PortfolioPoolContactRequest_share_requester_idx"
    ON "PortfolioPoolContactRequest"("shareId", "requesterCompanyAccountId", "status");
  CREATE INDEX IF NOT EXISTS "DeedTrackingCase_company_status_due_idx"
    ON "DeedTrackingCase"("companyAccountId", "status", "dueAt");
  CREATE INDEX IF NOT EXISTS "DeedTrackingCase_company_property_idx"
    ON "DeedTrackingCase"("companyAccountId", "propertyId");
  CREATE INDEX IF NOT EXISTS "DeedTrackingCase_member_status_idx"
    ON "DeedTrackingCase"("assignedMemberId", "status");
  CREATE INDEX IF NOT EXISTS "DeedTrackingEvent_case_created_idx"
    ON "DeedTrackingEvent"("companyAccountId", "deedTrackingCaseId", "createdAt");

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioPoolShare_owner_fkey'
      AND conrelid = '"PortfolioPoolShare"'::regclass
  ) THEN
    ALTER TABLE "PortfolioPoolShare" ADD CONSTRAINT "PortfolioPoolShare_owner_fkey"
      FOREIGN KEY ("ownerCompanyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioPoolShare_property_fkey'
      AND conrelid = '"PortfolioPoolShare"'::regclass
  ) THEN
    ALTER TABLE "PortfolioPoolShare" ADD CONSTRAINT "PortfolioPoolShare_property_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioPoolContactRequest_share_fkey'
      AND conrelid = '"PortfolioPoolContactRequest"'::regclass
  ) THEN
    ALTER TABLE "PortfolioPoolContactRequest" ADD CONSTRAINT "PortfolioPoolContactRequest_share_fkey"
      FOREIGN KEY ("shareId") REFERENCES "PortfolioPoolShare"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioPoolContactRequest_requester_fkey'
      AND conrelid = '"PortfolioPoolContactRequest"'::regclass
  ) THEN
    ALTER TABLE "PortfolioPoolContactRequest" ADD CONSTRAINT "PortfolioPoolContactRequest_requester_fkey"
      FOREIGN KEY ("requesterCompanyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PortfolioPoolContactRequest_owner_fkey'
      AND conrelid = '"PortfolioPoolContactRequest"'::regclass
  ) THEN
    ALTER TABLE "PortfolioPoolContactRequest" ADD CONSTRAINT "PortfolioPoolContactRequest_owner_fkey"
      FOREIGN KEY ("ownerCompanyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeedTrackingCase_company_fkey'
      AND conrelid = '"DeedTrackingCase"'::regclass
  ) THEN
    ALTER TABLE "DeedTrackingCase" ADD CONSTRAINT "DeedTrackingCase_company_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeedTrackingCase_property_fkey'
      AND conrelid = '"DeedTrackingCase"'::regclass
  ) THEN
    ALTER TABLE "DeedTrackingCase" ADD CONSTRAINT "DeedTrackingCase_property_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeedTrackingCase_contact_fkey'
      AND conrelid = '"DeedTrackingCase"'::regclass
  ) THEN
    ALTER TABLE "DeedTrackingCase" ADD CONSTRAINT "DeedTrackingCase_contact_fkey"
      FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeedTrackingCase_member_fkey'
      AND conrelid = '"DeedTrackingCase"'::regclass
  ) THEN
    ALTER TABLE "DeedTrackingCase" ADD CONSTRAINT "DeedTrackingCase_member_fkey"
      FOREIGN KEY ("assignedMemberId") REFERENCES "CompanyMember"("id") ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeedTrackingEvent_company_fkey'
      AND conrelid = '"DeedTrackingEvent"'::regclass
  ) THEN
    ALTER TABLE "DeedTrackingEvent" ADD CONSTRAINT "DeedTrackingEvent_company_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'DeedTrackingEvent_case_fkey'
      AND conrelid = '"DeedTrackingEvent"'::regclass
  ) THEN
    ALTER TABLE "DeedTrackingEvent" ADD CONSTRAINT "DeedTrackingEvent_case_fkey"
      FOREIGN KEY ("deedTrackingCaseId") REFERENCES "DeedTrackingCase"("id") ON DELETE CASCADE;
  END IF;

  INSERT INTO "_JasmineDeployMigration" ("name")
  VALUES ('20260805220000_authorized_pool_deed_tracking');
END
$migration$;
