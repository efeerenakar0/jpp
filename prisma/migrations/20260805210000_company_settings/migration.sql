-- Tenant-scoped company settings and ordered employee escalation policy.
-- This file can be executed on every Vercel build; the marker makes it idempotent.

CREATE TABLE IF NOT EXISTS "_JasmineDeployMigration" (
  "name" TEXT PRIMARY KEY,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

DO $migration$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtext('20260805210000_company_settings'));

  IF EXISTS (
    SELECT 1 FROM "_JasmineDeployMigration"
    WHERE "name" = '20260805210000_company_settings'
  ) THEN
    RETURN;
  END IF;

  CREATE TABLE IF NOT EXISTS "CompanySettings" (
    "id" TEXT PRIMARY KEY,
    "companyAccountId" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "district" TEXT,
    "latitude" DOUBLE PRECISION,
    "longitude" DOUBLE PRECISION,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "contactPhoneNormalized" TEXT,
    "locale" TEXT NOT NULL DEFAULT 'tr-TR',
    "websiteStatus" TEXT NOT NULL DEFAULT 'NONE',
    "websiteUrl" TEXT,
    "hostingProvider" TEXT,
    "instagramUrl" TEXT,
    "facebookUrl" TEXT,
    "tiktokUrl" TEXT,
    "xUrl" TEXT,
    "linkedinUrl" TEXT,
    "workHours" JSONB NOT NULL,
    "customerResponseMinutes" INTEGER NOT NULL DEFAULT 15,
    "employeeReminderMinutes" INTEGER NOT NULL DEFAULT 5,
    "employeeAcknowledgementMinutes" INTEGER NOT NULL DEFAULT 15,
    "ownerEscalationMinutes" INTEGER NOT NULL DEFAULT 15,
    "ownerNoResponseAction" TEXT NOT NULL DEFAULT 'CREATE_CRITICAL_TASK',
    "appointmentReminderHours" INTEGER NOT NULL DEFAULT 24,
    "appointmentOutcomeDelayMinutes" INTEGER NOT NULL DEFAULT 30,
    "ownerNotifications" JSONB NOT NULL,
    "aiAutomationPermissions" JSONB NOT NULL,
    "dataProcessingAccepted" BOOLEAN NOT NULL DEFAULT false,
    "dataProcessingAcceptedAt" TIMESTAMP(3),
    "dataProcessingRevokedAt" TIMESTAMP(3),
    "dataProcessingConsentVersion" TEXT,
    "setupDisposition" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
    "setupCurrentStep" INTEGER NOT NULL DEFAULT 1,
    "setupDeferredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS "CompanyEscalationStep" (
    "id" TEXT PRIMARY KEY,
    "companyAccountId" TEXT NOT NULL,
    "settingsId" TEXT NOT NULL,
    "memberId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE UNIQUE INDEX IF NOT EXISTS "CompanySettings_companyAccountId_key"
    ON "CompanySettings"("companyAccountId");
  CREATE INDEX IF NOT EXISTS "CompanySettings_company_setup_idx"
    ON "CompanySettings"("companyAccountId", "setupDisposition");
  CREATE UNIQUE INDEX IF NOT EXISTS "CompanyEscalationStep_company_member_key"
    ON "CompanyEscalationStep"("companyAccountId", "memberId");
  CREATE UNIQUE INDEX IF NOT EXISTS "CompanyEscalationStep_settings_priority_key"
    ON "CompanyEscalationStep"("settingsId", "priority");
  CREATE INDEX IF NOT EXISTS "CompanyEscalationStep_company_priority_idx"
    ON "CompanyEscalationStep"("companyAccountId", "priority");

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompanySettings_company_fkey'
      AND conrelid = '"CompanySettings"'::regclass
  ) THEN
    ALTER TABLE "CompanySettings"
      ADD CONSTRAINT "CompanySettings_company_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompanyEscalationStep_company_fkey'
      AND conrelid = '"CompanyEscalationStep"'::regclass
  ) THEN
    ALTER TABLE "CompanyEscalationStep"
      ADD CONSTRAINT "CompanyEscalationStep_company_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompanyEscalationStep_settings_fkey'
      AND conrelid = '"CompanyEscalationStep"'::regclass
  ) THEN
    ALTER TABLE "CompanyEscalationStep"
      ADD CONSTRAINT "CompanyEscalationStep_settings_fkey"
      FOREIGN KEY ("settingsId") REFERENCES "CompanySettings"("id")
      ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CompanyEscalationStep_member_fkey'
      AND conrelid = '"CompanyEscalationStep"'::regclass
  ) THEN
    ALTER TABLE "CompanyEscalationStep"
      ADD CONSTRAINT "CompanyEscalationStep_member_fkey"
      FOREIGN KEY ("memberId") REFERENCES "CompanyMember"("id")
      ON DELETE CASCADE;
  END IF;

  INSERT INTO "_JasmineDeployMigration" ("name")
  VALUES ('20260805210000_company_settings');
END
$migration$;
