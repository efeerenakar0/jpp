DO $$ BEGIN
  CREATE TYPE "CompanyMemberRole" AS ENUM ('OWNER', 'MANAGER', 'AGENT', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CrmContactType" AS ENUM ('BUYER', 'SELLER', 'INVESTOR', 'TENANT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CrmContactStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'VIEWING', 'OFFER', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "ConsentStatus" AS ENUM ('UNKNOWN', 'GRANTED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CrmPropertyStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RESERVED', 'SOLD', 'RENTED', 'ARCHIVED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CrmDealStage" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'MATCHED', 'VIEWING', 'OFFER', 'CONTRACT', 'WON', 'LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CrmTaskStatus" AS ENUM ('OPEN', 'COMPLETED', 'CANCELLED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "CrmTaskType" AS ENUM ('CALL', 'MESSAGE', 'MEETING', 'VIEWING', 'FOLLOW_UP', 'DOCUMENT', 'OTHER');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "CompanyMember" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "role" "CompanyMemberRole" NOT NULL DEFAULT 'AGENT',
  "active" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CompanyMember_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyMember_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyMember_companyAccountId_email_key"
  ON "CompanyMember"("companyAccountId", "email");
CREATE INDEX IF NOT EXISTS "CompanyMember_companyAccountId_active_idx"
  ON "CompanyMember"("companyAccountId", "active");

CREATE TABLE IF NOT EXISTS "CrmContact" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "assignedMemberId" TEXT,
  "name" TEXT NOT NULL,
  "phone" TEXT,
  "email" TEXT,
  "type" "CrmContactType" NOT NULL DEFAULT 'BUYER',
  "stage" "CrmContactStage" NOT NULL DEFAULT 'NEW',
  "source" TEXT,
  "desiredLocation" TEXT,
  "desiredRoomCount" TEXT,
  "budgetMin" DOUBLE PRECISION,
  "budgetMax" DOUBLE PRECISION,
  "notes" TEXT,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "score" INTEGER NOT NULL DEFAULT 50,
  "consentStatus" "ConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "consentUpdatedAt" TIMESTAMP(3),
  "nextActionAt" TIMESTAMP(3),
  "sourceConversationId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmContact_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmContact_assignedMemberId_fkey"
    FOREIGN KEY ("assignedMemberId") REFERENCES "CompanyMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmContact_companyAccountId_sourceConversationId_key"
  ON "CrmContact"("companyAccountId", "sourceConversationId");
CREATE INDEX IF NOT EXISTS "CrmContact_companyAccountId_stage_idx"
  ON "CrmContact"("companyAccountId", "stage");
CREATE INDEX IF NOT EXISTS "CrmContact_companyAccountId_phone_idx"
  ON "CrmContact"("companyAccountId", "phone");
CREATE INDEX IF NOT EXISTS "CrmContact_assignedMemberId_idx"
  ON "CrmContact"("assignedMemberId");

CREATE TABLE IF NOT EXISTS "CrmProperty" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "ownerContactId" TEXT,
  "assignedMemberId" TEXT,
  "title" TEXT NOT NULL,
  "referenceCode" TEXT,
  "location" TEXT,
  "price" DOUBLE PRECISION,
  "roomCount" TEXT,
  "area" DOUBLE PRECISION,
  "status" "CrmPropertyStatus" NOT NULL DEFAULT 'DRAFT',
  "description" TEXT,
  "imageUrl" TEXT,
  "sourceListingId" TEXT,
  "sellerPortalToken" TEXT NOT NULL,
  "sellerPortalEnabled" BOOLEAN NOT NULL DEFAULT TRUE,
  "listingViews" INTEGER NOT NULL DEFAULT 0,
  "inquiryCount" INTEGER NOT NULL DEFAULT 0,
  "showingCount" INTEGER NOT NULL DEFAULT 0,
  "offerCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmProperty_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmProperty_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmProperty_ownerContactId_fkey"
    FOREIGN KEY ("ownerContactId") REFERENCES "CrmContact"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CrmProperty_assignedMemberId_fkey"
    FOREIGN KEY ("assignedMemberId") REFERENCES "CompanyMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmProperty_sellerPortalToken_key"
  ON "CrmProperty"("sellerPortalToken");
CREATE UNIQUE INDEX IF NOT EXISTS "CrmProperty_companyAccountId_sourceListingId_key"
  ON "CrmProperty"("companyAccountId", "sourceListingId");
CREATE INDEX IF NOT EXISTS "CrmProperty_companyAccountId_status_idx"
  ON "CrmProperty"("companyAccountId", "status");
CREATE INDEX IF NOT EXISTS "CrmProperty_ownerContactId_idx"
  ON "CrmProperty"("ownerContactId");
CREATE INDEX IF NOT EXISTS "CrmProperty_assignedMemberId_idx"
  ON "CrmProperty"("assignedMemberId");

CREATE TABLE IF NOT EXISTS "CrmDeal" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "propertyId" TEXT,
  "assignedMemberId" TEXT,
  "title" TEXT NOT NULL,
  "stage" "CrmDealStage" NOT NULL DEFAULT 'NEW',
  "estimatedValue" DOUBLE PRECISION,
  "commissionRate" DOUBLE PRECISION DEFAULT 2,
  "probability" INTEGER NOT NULL DEFAULT 20,
  "nextAction" TEXT,
  "expectedCloseAt" TIMESTAMP(3),
  "closedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmDeal_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmDeal_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmDeal_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmDeal_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "CrmDeal_assignedMemberId_fkey"
    FOREIGN KEY ("assignedMemberId") REFERENCES "CompanyMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CrmDeal_companyAccountId_stage_idx"
  ON "CrmDeal"("companyAccountId", "stage");
CREATE INDEX IF NOT EXISTS "CrmDeal_contactId_idx" ON "CrmDeal"("contactId");
CREATE INDEX IF NOT EXISTS "CrmDeal_propertyId_idx" ON "CrmDeal"("propertyId");
CREATE INDEX IF NOT EXISTS "CrmDeal_assignedMemberId_idx" ON "CrmDeal"("assignedMemberId");

CREATE TABLE IF NOT EXISTS "CrmTask" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "contactId" TEXT,
  "propertyId" TEXT,
  "dealId" TEXT,
  "assignedMemberId" TEXT,
  "type" "CrmTaskType" NOT NULL DEFAULT 'FOLLOW_UP',
  "title" TEXT NOT NULL,
  "description" TEXT,
  "dueAt" TIMESTAMP(3),
  "priority" INTEGER NOT NULL DEFAULT 2,
  "status" "CrmTaskStatus" NOT NULL DEFAULT 'OPEN',
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmTask_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmTask_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmTask_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmTask_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmTask_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmTask_assignedMemberId_fkey"
    FOREIGN KEY ("assignedMemberId") REFERENCES "CompanyMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CrmTask_companyAccountId_status_dueAt_idx"
  ON "CrmTask"("companyAccountId", "status", "dueAt");
CREATE INDEX IF NOT EXISTS "CrmTask_assignedMemberId_idx"
  ON "CrmTask"("assignedMemberId");

CREATE TABLE IF NOT EXISTS "CrmMatch" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "score" INTEGER NOT NULL,
  "reasons" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" TEXT NOT NULL DEFAULT 'NEW',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmMatch_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmMatch_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmMatch_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmMatch_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmMatch_companyAccountId_contactId_propertyId_key"
  ON "CrmMatch"("companyAccountId", "contactId", "propertyId");
CREATE INDEX IF NOT EXISTS "CrmMatch_companyAccountId_score_idx"
  ON "CrmMatch"("companyAccountId", "score");

CREATE TABLE IF NOT EXISTS "CrmActivity" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "contactId" TEXT,
  "propertyId" TEXT,
  "dealId" TEXT,
  "actorMemberId" TEXT,
  "type" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "metadata" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CrmActivity_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmActivity_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmActivity_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "CrmContact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmActivity_propertyId_fkey"
    FOREIGN KEY ("propertyId") REFERENCES "CrmProperty"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmActivity_dealId_fkey"
    FOREIGN KEY ("dealId") REFERENCES "CrmDeal"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CrmActivity_actorMemberId_fkey"
    FOREIGN KEY ("actorMemberId") REFERENCES "CompanyMember"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX IF NOT EXISTS "CrmActivity_companyAccountId_createdAt_idx"
  ON "CrmActivity"("companyAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "CrmActivity_contactId_idx" ON "CrmActivity"("contactId");
CREATE INDEX IF NOT EXISTS "CrmActivity_propertyId_idx" ON "CrmActivity"("propertyId");
CREATE INDEX IF NOT EXISTS "CrmActivity_dealId_idx" ON "CrmActivity"("dealId");
