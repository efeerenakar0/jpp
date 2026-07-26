DO $$ BEGIN
  CREATE TYPE "CompanyAccountStatus" AS ENUM (
    'ACTIVE',
    'SUSPENDED',
    'CLOSED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "SubscriptionStatus" AS ENUM (
    'TRIAL',
    'ACTIVE',
    'PAUSED',
    'CANCELLED',
    'EXPIRED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "AiProvider" AS ENUM (
    'OPENAI',
    'GEMINI'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CompanyAccount" (
  "id" TEXT NOT NULL,
  "companyName" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "ownerName" TEXT NOT NULL,
  "ownerEmail" TEXT,
  "accessKeyLookup" TEXT,
  "accessKeyHash" TEXT,
  "accessKeyHint" TEXT,
  "verificationCodeHash" TEXT,
  "verificationCodeHint" TEXT,
  "status" "CompanyAccountStatus" NOT NULL DEFAULT 'ACTIVE',
  "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
  "subscriptionPlan" TEXT NOT NULL DEFAULT 'standard',
  "subscriptionEndsAt" TIMESTAMP(3),
  "workspaceEnabled" BOOLEAN NOT NULL DEFAULT FALSE,
  "sessionVersion" INTEGER NOT NULL DEFAULT 1,
  "lastLoginAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyAccount_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "CompanyAccount"
  ADD COLUMN IF NOT EXISTS "sessionVersion" INTEGER NOT NULL DEFAULT 1;

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyAccount_slug_key"
  ON "CompanyAccount"("slug");

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyAccount_accessKeyLookup_key"
  ON "CompanyAccount"("accessKeyLookup");

CREATE INDEX IF NOT EXISTS "CompanyAccount_status_subscriptionStatus_idx"
  ON "CompanyAccount"("status", "subscriptionStatus");

CREATE INDEX IF NOT EXISTS "CompanyAccount_createdAt_idx"
  ON "CompanyAccount"("createdAt");

CREATE TABLE IF NOT EXISTS "CompanyAiCredential" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "provider" "AiProvider" NOT NULL,
  "encryptedApiKey" TEXT NOT NULL,
  "keyHint" TEXT NOT NULL,
  "model" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyAiCredential_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyAiCredential_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId")
    REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE
    ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyAiCredential_companyAccountId_provider_key"
  ON "CompanyAiCredential"("companyAccountId", "provider");

CREATE TABLE IF NOT EXISTS "PlatformAdminLoginAttempt" (
  "id" TEXT NOT NULL,
  "keyHash" TEXT NOT NULL,
  "succeeded" BOOLEAN NOT NULL DEFAULT FALSE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlatformAdminLoginAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PlatformAdminLoginAttempt_keyHash_createdAt_idx"
  ON "PlatformAdminLoginAttempt"("keyHash", "createdAt");

CREATE INDEX IF NOT EXISTS "PlatformAdminLoginAttempt_createdAt_idx"
  ON "PlatformAdminLoginAttempt"("createdAt");
