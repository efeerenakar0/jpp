DO $$
BEGIN
  CREATE TYPE "DocumentRecordStatus" AS ENUM ('DRAFT', 'GENERATED', 'ARCHIVED', 'CANCELLED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DocumentLegalReviewStatus" AS ENUM ('DRAFT', 'COMPANY_APPROVED', 'LEGAL_REVIEWED', 'NEEDS_UPDATE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DocumentAuditAction" AS ENUM (
    'CREATED',
    'VIEWED',
    'UPDATED',
    'GENERATED',
    'DOWNLOADED_PDF',
    'DOWNLOADED_DOCX',
    'DUPLICATED',
    'ARCHIVED',
    'CANCELLED',
    'SOFT_DELETED',
    'RESTORED',
    'FAVORITED',
    'UNFAVORITED'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "DocumentTemplate" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "estimatedMinutes" INTEGER NOT NULL DEFAULT 5,
  "version" INTEGER NOT NULL DEFAULT 1,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "lastReviewedAt" TIMESTAMP(3) NOT NULL,
  "legalStatus" "DocumentLegalReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "legalNotice" TEXT NOT NULL,
  "officialFormWarning" TEXT,
  "schema" JSONB NOT NULL,
  "content" JSONB NOT NULL,
  "sources" JSONB NOT NULL,
  "signatureRoles" JSONB NOT NULL,
  "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DocumentTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "CompanyDocument" (
  "id" TEXT NOT NULL,
  "publicId" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "templateId" TEXT NOT NULL,
  "documentNumber" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "status" "DocumentRecordStatus" NOT NULL DEFAULT 'DRAFT',
  "legalStatus" "DocumentLegalReviewStatus" NOT NULL DEFAULT 'DRAFT',
  "templateKey" TEXT NOT NULL,
  "templateVersion" INTEGER NOT NULL,
  "values" JSONB NOT NULL,
  "templateSnapshot" JSONB NOT NULL,
  "renderedSnapshot" JSONB,
  "contextSnapshot" JSONB NOT NULL,
  "versionGroupId" TEXT NOT NULL,
  "versionNumber" INTEGER NOT NULL DEFAULT 1,
  "parentDocumentId" TEXT,
  "createdByType" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdByName" TEXT NOT NULL,
  "lastEditedByType" TEXT NOT NULL,
  "lastEditedById" TEXT NOT NULL,
  "lastEditedByName" TEXT NOT NULL,
  "generatedAt" TIMESTAMP(3),
  "archivedAt" TIMESTAMP(3),
  "cancelledAt" TIMESTAMP(3),
  "deletedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "CompanyDocument_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CompanyDocument_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "CompanyDocument_templateId_fkey"
    FOREIGN KEY ("templateId") REFERENCES "DocumentTemplate"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "CompanyDocument_parentDocumentId_fkey"
    FOREIGN KEY ("parentDocumentId") REFERENCES "CompanyDocument"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DocumentFavorite" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "actorKey" TEXT NOT NULL,
  "templateKey" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentFavorite_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentFavorite_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DocumentAuditLog" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "documentId" TEXT,
  "action" "DocumentAuditAction" NOT NULL,
  "actorType" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "actorName" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DocumentAuditLog_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "DocumentAuditLog_companyAccountId_fkey"
    FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "DocumentAuditLog_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "CompanyDocument"("id")
    ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentTemplate_key_version_key"
  ON "DocumentTemplate"("key", "version");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_active_category_idx"
  ON "DocumentTemplate"("active", "category");
CREATE INDEX IF NOT EXISTS "DocumentTemplate_name_idx"
  ON "DocumentTemplate"("name");

CREATE UNIQUE INDEX IF NOT EXISTS "CompanyDocument_publicId_key"
  ON "CompanyDocument"("publicId");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyDocument_companyAccountId_documentNumber_key"
  ON "CompanyDocument"("companyAccountId", "documentNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "CompanyDocument_companyAccountId_versionGroupId_versionNumber_key"
  ON "CompanyDocument"("companyAccountId", "versionGroupId", "versionNumber");
CREATE INDEX IF NOT EXISTS "CompanyDocument_companyAccountId_status_deletedAt_updatedAt_idx"
  ON "CompanyDocument"("companyAccountId", "status", "deletedAt", "updatedAt");
CREATE INDEX IF NOT EXISTS "CompanyDocument_companyAccountId_templateKey_createdAt_idx"
  ON "CompanyDocument"("companyAccountId", "templateKey", "createdAt");
CREATE INDEX IF NOT EXISTS "CompanyDocument_parentDocumentId_idx"
  ON "CompanyDocument"("parentDocumentId");

CREATE UNIQUE INDEX IF NOT EXISTS "DocumentFavorite_companyAccountId_actorKey_templateKey_key"
  ON "DocumentFavorite"("companyAccountId", "actorKey", "templateKey");
CREATE INDEX IF NOT EXISTS "DocumentFavorite_companyAccountId_actorKey_idx"
  ON "DocumentFavorite"("companyAccountId", "actorKey");

CREATE INDEX IF NOT EXISTS "DocumentAuditLog_companyAccountId_createdAt_idx"
  ON "DocumentAuditLog"("companyAccountId", "createdAt");
CREATE INDEX IF NOT EXISTS "DocumentAuditLog_documentId_createdAt_idx"
  ON "DocumentAuditLog"("documentId", "createdAt");
