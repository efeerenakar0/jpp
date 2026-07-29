-- Avcı v2: izinli kaynak işleri, ayrıntılı ilan kayıtları ve fail-closed iletişim politikası.
-- Bu migration eski HuntedListing.ownerPhone alanını silmez. Mevcut numaralar yalnızca
-- maskelenmiş, kullanıma kapalı LEGACY_UNVERIFIED kayıtlar olarak karantinaya alınır.

DO $$ BEGIN
  CREATE TYPE "SourceProvider" AS ENUM ('SAHIBINDEN', 'FIXTURE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SourceAuthorizationStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "SourceScope" AS ENUM ('SEARCH_READ', 'DETAIL_READ', 'MEDIA_READ', 'MEDIA_COPY', 'CONTACT_READ');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HuntJobStatus" AS ENUM ('QUEUED', 'RUNNING', 'PAUSED', 'COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED', 'SOURCE_CHALLENGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HuntingAcquisitionStatus" AS ENUM ('DISCOVERED', 'DETAIL_COMPLETE', 'PARTIAL', 'UNAVAILABLE', 'REMOVED', 'SOURCE_CHALLENGE');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "AddressPrecision" AS ENUM ('UNKNOWN', 'CITY', 'DISTRICT', 'NEIGHBORHOOD', 'STREET', 'EXACT');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContactSubjectRole" AS ENUM ('OWNER', 'AUTHORIZED_REPRESENTATIVE', 'AGENT', 'UNKNOWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HuntedContactSourceType" AS ENUM ('PARTNER_FEED', 'BANA_EMLAKCI_BUL', 'FIRST_PARTY_FORM', 'EXISTING_CRM', 'MANUAL_VERIFIED', 'LEGACY_UNVERIFIED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "HuntedContactVerificationStatus" AS ENUM ('UNVERIFIED', 'OTP_VERIFIED', 'PARTNER_VERIFIED', 'MANUALLY_VERIFIED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContactLegalBasisStatus" AS ENUM ('UNKNOWN', 'CONFIRMED', 'REJECTED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContactConsentChannel" AS ENUM ('VOICE', 'WHATSAPP', 'SMS', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "ContactConsentStatus" AS ENUM ('UNKNOWN', 'GRANTED', 'REJECTED', 'REVOKED', 'EXPIRED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "OutreachApprovalStatus" AS ENUM ('APPROVED', 'REVOKED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "SourceAuthorization" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "provider" "SourceProvider" NOT NULL,
  "status" "SourceAuthorizationStatus" NOT NULL DEFAULT 'PENDING',
  "allowedScopes" "SourceScope"[] NOT NULL,
  "contractReference" TEXT NOT NULL,
  "startsAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SourceAuthorization_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SourceAuthorization_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "HuntJob" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "sourceAuthorizationId" TEXT NOT NULL,
  "provider" "SourceProvider" NOT NULL,
  "searchUrl" TEXT NOT NULL,
  "idempotencyKey" TEXT NOT NULL,
  "status" "HuntJobStatus" NOT NULL DEFAULT 'QUEUED',
  "totalDiscovered" INTEGER NOT NULL DEFAULT 0,
  "totalCompleted" INTEGER NOT NULL DEFAULT 0,
  "totalPartial" INTEGER NOT NULL DEFAULT 0,
  "totalFailed" INTEGER NOT NULL DEFAULT 0,
  "errorSummary" TEXT,
  "createdBy" TEXT NOT NULL,
  "startedAt" TIMESTAMP(3),
  "pausedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntJob_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HuntJob_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HuntJob_sourceAuthorizationId_fkey"
    FOREIGN KEY ("sourceAuthorizationId") REFERENCES "SourceAuthorization"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE
);

ALTER TABLE "HuntedListing"
  ADD COLUMN IF NOT EXISTS "huntJobId" TEXT,
  ADD COLUMN IF NOT EXISTS "sourceProvider" "SourceProvider",
  ADD COLUMN IF NOT EXISTS "sourceListingId" TEXT,
  ADD COLUMN IF NOT EXISTS "descriptionText" TEXT,
  ADD COLUMN IF NOT EXISTS "sanitizedDescriptionHtml" TEXT,
  ADD COLUMN IF NOT EXISTS "category" TEXT,
  ADD COLUMN IF NOT EXISTS "subcategory" TEXT,
  ADD COLUMN IF NOT EXISTS "sellerType" TEXT,
  ADD COLUMN IF NOT EXISTS "listingPublishedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "priceAmount" DECIMAL(18,2),
  ADD COLUMN IF NOT EXISTS "currency" TEXT,
  ADD COLUMN IF NOT EXISTS "province" TEXT,
  ADD COLUMN IF NOT EXISTS "district" TEXT,
  ADD COLUMN IF NOT EXISTS "neighborhood" TEXT,
  ADD COLUMN IF NOT EXISTS "street" TEXT,
  ADD COLUMN IF NOT EXISTS "latitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "longitude" DECIMAL(10,7),
  ADD COLUMN IF NOT EXISTS "addressPrecision" "AddressPrecision" NOT NULL DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS "acquisitionStatus" "HuntingAcquisitionStatus" NOT NULL DEFAULT 'DISCOVERED',
  ADD COLUMN IF NOT EXISTS "completenessScore" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "attributesJson" JSONB,
  ADD COLUMN IF NOT EXISTS "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS "removedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP(3);

DO $$ BEGIN
  ALTER TABLE "HuntedListing"
    ADD CONSTRAINT "HuntedListing_huntJobId_fkey"
    FOREIGN KEY ("huntJobId") REFERENCES "HuntJob"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "HuntedListingImage" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "order" INTEGER NOT NULL,
  "sourceUrl" TEXT NOT NULL,
  "storageKey" TEXT,
  "checksum" TEXT,
  "mimeType" TEXT,
  "width" INTEGER,
  "height" INTEGER,
  "byteSize" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntedListingImage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HuntedListingImage_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "HuntedListing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "HuntedContact" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "listingId" TEXT,
  "phoneCiphertext" TEXT,
  "phoneHmac" TEXT NOT NULL,
  "maskedPhone" TEXT NOT NULL,
  "subjectRole" "ContactSubjectRole" NOT NULL DEFAULT 'UNKNOWN',
  "sourceType" "HuntedContactSourceType" NOT NULL,
  "sourceReference" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "sourcePurposeAllowed" BOOLEAN,
  "verificationStatus" "HuntedContactVerificationStatus" NOT NULL DEFAULT 'UNVERIFIED',
  "verifiedAt" TIMESTAMP(3),
  "verificationMethod" TEXT,
  "legalBasisStatus" "ContactLegalBasisStatus" NOT NULL DEFAULT 'UNKNOWN',
  "retentionUntil" TIMESTAMP(3),
  "quarantinedAt" TIMESTAMP(3),
  "quarantineReason" TEXT,
  "doNotContactAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "HuntedContact_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HuntedContact_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HuntedContact_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "HuntedListing"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContactConsent" (
  "id" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "channel" "ContactConsentChannel" NOT NULL,
  "purpose" TEXT NOT NULL,
  "status" "ContactConsentStatus" NOT NULL DEFAULT 'UNKNOWN',
  "consentTextVersion" TEXT,
  "evidenceReference" TEXT,
  "grantedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "iysStatus" TEXT,
  "iysCheckedAt" TIMESTAMP(3),
  "iysTransactionReference" TEXT,
  "recipientType" TEXT,
  "recipientTypeEvidence" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ContactConsent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactConsent_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "HuntedContact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContactConsent_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ContactPolicyDecision" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "channel" "ContactConsentChannel" NOT NULL,
  "purpose" TEXT NOT NULL,
  "allowed" BOOLEAN NOT NULL,
  "reasonCodes" TEXT[] NOT NULL,
  "evaluatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "evaluatedBy" TEXT NOT NULL,
  CONSTRAINT "ContactPolicyDecision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ContactPolicyDecision_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContactPolicyDecision_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "HuntedListing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ContactPolicyDecision_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "HuntedContact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "HuntedOutreachApproval" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "contactId" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "channel" "ContactConsentChannel" NOT NULL,
  "status" "OutreachApprovalStatus" NOT NULL DEFAULT 'APPROVED',
  "approvedByType" TEXT NOT NULL,
  "approvedById" TEXT NOT NULL,
  "approvedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "HuntedOutreachApproval_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "HuntedOutreachApproval_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HuntedOutreachApproval_listingId_fkey"
    FOREIGN KEY ("listingId") REFERENCES "HuntedListing"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "HuntedOutreachApproval_contactId_fkey"
    FOREIGN KEY ("contactId") REFERENCES "HuntedContact"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "SourceAuthorization_companyAccountId_provider_contractRef_key"
  ON "SourceAuthorization"("companyAccountId", "provider", "contractReference");
CREATE INDEX IF NOT EXISTS "SourceAuthorization_company_provider_status_expires_idx"
  ON "SourceAuthorization"("companyAccountId", "provider", "status", "expiresAt");

CREATE UNIQUE INDEX IF NOT EXISTS "HuntJob_companyAccountId_idempotencyKey_key"
  ON "HuntJob"("companyAccountId", "idempotencyKey");
CREATE INDEX IF NOT EXISTS "HuntJob_companyAccountId_status_createdAt_idx"
  ON "HuntJob"("companyAccountId", "status", "createdAt");
CREATE INDEX IF NOT EXISTS "HuntJob_status_updatedAt_idx"
  ON "HuntJob"("status", "updatedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "HuntedListing_company_sourceProvider_sourceListingId_key"
  ON "HuntedListing"("companyAccountId", "sourceProvider", "sourceListingId");
CREATE INDEX IF NOT EXISTS "HuntedListing_company_acquisition_completeness_idx"
  ON "HuntedListing"("companyAccountId", "acquisitionStatus", "completenessScore");
CREATE INDEX IF NOT EXISTS "HuntedListing_huntJobId_acquisitionStatus_idx"
  ON "HuntedListing"("huntJobId", "acquisitionStatus");
CREATE INDEX IF NOT EXISTS "HuntedListing_sourceProvider_sourceListingId_idx"
  ON "HuntedListing"("sourceProvider", "sourceListingId");

CREATE UNIQUE INDEX IF NOT EXISTS "HuntedListingImage_listingId_order_key"
  ON "HuntedListingImage"("listingId", "order");
CREATE UNIQUE INDEX IF NOT EXISTS "HuntedListingImage_listingId_sourceUrl_key"
  ON "HuntedListingImage"("listingId", "sourceUrl");
CREATE INDEX IF NOT EXISTS "HuntedListingImage_listingId_order_idx"
  ON "HuntedListingImage"("listingId", "order");

CREATE UNIQUE INDEX IF NOT EXISTS "HuntedContact_company_phoneHmac_listingId_key"
  ON "HuntedContact"("companyAccountId", "phoneHmac", "listingId");
CREATE INDEX IF NOT EXISTS "HuntedContact_company_verification_doNotContact_idx"
  ON "HuntedContact"("companyAccountId", "verificationStatus", "doNotContactAt");
CREATE INDEX IF NOT EXISTS "HuntedContact_listingId_sourceType_idx"
  ON "HuntedContact"("listingId", "sourceType");

CREATE UNIQUE INDEX IF NOT EXISTS "ContactConsent_contact_company_channel_purpose_key"
  ON "ContactConsent"("contactId", "companyAccountId", "channel", "purpose");
CREATE INDEX IF NOT EXISTS "ContactConsent_company_channel_status_idx"
  ON "ContactConsent"("companyAccountId", "channel", "status");

CREATE INDEX IF NOT EXISTS "ContactPolicyDecision_company_contact_evaluatedAt_idx"
  ON "ContactPolicyDecision"("companyAccountId", "contactId", "evaluatedAt");
CREATE INDEX IF NOT EXISTS "ContactPolicyDecision_listingId_evaluatedAt_idx"
  ON "ContactPolicyDecision"("listingId", "evaluatedAt");

CREATE INDEX IF NOT EXISTS "HuntedOutreachApproval_company_listing_contact_status_idx"
  ON "HuntedOutreachApproval"("companyAccountId", "listingId", "contactId", "status");
CREATE INDEX IF NOT EXISTS "HuntedOutreachApproval_contact_channel_purpose_approvedAt_idx"
  ON "HuntedOutreachApproval"("contactId", "channel", "purpose", "approvedAt");

ALTER TABLE "WhatsAppOutboxMessage"
  ADD COLUMN IF NOT EXISTS "huntedContactId" TEXT;

DO $$ BEGIN
  ALTER TABLE "WhatsAppOutboxMessage"
    ADD CONSTRAINT "WhatsAppOutboxMessage_huntedContactId_fkey"
    FOREIGN KEY ("huntedContactId") REFERENCES "HuntedContact"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "WhatsAppOutboxMessage_company_huntedContact_createdAt_idx"
  ON "WhatsAppOutboxMessage"("companyAccountId", "huntedContactId", "createdAt");

-- Eski düz metin numaraları şifreli iletişim kaydı sayılmaz. Gerçek numara taşınmaz;
-- yalnızca son dört hanesi gösterilen ve her zaman reddedilen bir karantina izi tutulur.
INSERT INTO "HuntedContact" (
  "id",
  "companyAccountId",
  "listingId",
  "phoneCiphertext",
  "phoneHmac",
  "maskedPhone",
  "subjectRole",
  "sourceType",
  "sourceReference",
  "purpose",
  "sourcePurposeAllowed",
  "verificationStatus",
  "legalBasisStatus",
  "quarantinedAt",
  "quarantineReason",
  "createdAt",
  "updatedAt"
)
SELECT
  'legacy-contact-' || listing."id",
  listing."companyAccountId",
  listing."id",
  NULL,
  'legacy:' || listing."id",
  '••••' || RIGHT(regexp_replace(COALESCE(listing."ownerPhone", ''), '\D', '', 'g'), 4),
  'UNKNOWN'::"ContactSubjectRole",
  'LEGACY_UNVERIFIED'::"HuntedContactSourceType",
  'legacy:HuntedListing.ownerPhone:' || listing."id",
  'SALES_AUTHORITY_DISCUSSION',
  false,
  'UNVERIFIED'::"HuntedContactVerificationStatus",
  'UNKNOWN'::"ContactLegalBasisStatus",
  CURRENT_TIMESTAMP,
  'LEGACY_UNVERIFIED',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "HuntedListing" listing
WHERE listing."companyAccountId" IS NOT NULL
  AND NULLIF(TRIM(COALESCE(listing."ownerPhone", '')), '') IS NOT NULL
ON CONFLICT ("companyAccountId", "phoneHmac", "listingId") DO NOTHING;
