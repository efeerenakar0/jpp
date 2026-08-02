CREATE TABLE IF NOT EXISTS "WebsitePromptVersion" (
    "id" TEXT NOT NULL,
    "companyAccountId" TEXT NOT NULL,
    "websiteIntegrationId" TEXT,
    "generatedWebsiteId" TEXT,
    "version" INTEGER NOT NULL,
    "promptTemplate" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "createdByType" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "sourceSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "WebsitePromptVersion_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebsitePromptVersion_websiteIntegrationId_version_key"
ON "WebsitePromptVersion"("websiteIntegrationId", "version");
CREATE UNIQUE INDEX IF NOT EXISTS "WebsitePromptVersion_generatedWebsiteId_version_key"
ON "WebsitePromptVersion"("generatedWebsiteId", "version");
CREATE INDEX IF NOT EXISTS "WebsitePromptVersion_companyAccountId_createdAt_idx"
ON "WebsitePromptVersion"("companyAccountId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebsitePromptVersion_companyAccountId_fkey') THEN
    ALTER TABLE "WebsitePromptVersion" ADD CONSTRAINT "WebsitePromptVersion_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebsitePromptVersion_websiteIntegrationId_fkey') THEN
    ALTER TABLE "WebsitePromptVersion" ADD CONSTRAINT "WebsitePromptVersion_websiteIntegrationId_fkey"
      FOREIGN KEY ("websiteIntegrationId") REFERENCES "WebsiteIntegration"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'WebsitePromptVersion_generatedWebsiteId_fkey') THEN
    ALTER TABLE "WebsitePromptVersion" ADD CONSTRAINT "WebsitePromptVersion_generatedWebsiteId_fkey"
      FOREIGN KEY ("generatedWebsiteId") REFERENCES "GeneratedWebsite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

INSERT INTO "WebsitePromptVersion" (
  "id", "companyAccountId", "websiteIntegrationId", "version",
  "promptTemplate", "source", "createdByType", "createdById", "createdAt", "updatedAt"
)
SELECT 'legacy-integration-' || wi."id", wi."companyAccountId", wi."id", 1,
  wi."promptTemplate", 'LEGACY_IMPORT', 'SYSTEM', wi."companyAccountId", wi."createdAt", wi."updatedAt"
FROM "WebsiteIntegration" wi
WHERE NOT EXISTS (SELECT 1 FROM "WebsitePromptVersion" wpv WHERE wpv."websiteIntegrationId" = wi."id");

INSERT INTO "WebsitePromptVersion" (
  "id", "companyAccountId", "generatedWebsiteId", "version",
  "promptTemplate", "source", "createdByType", "createdById", "createdAt", "updatedAt"
)
SELECT 'legacy-generated-' || gw."id", gw."companyAccountId", gw."id", 1,
  gw."promptTemplate", 'LEGACY_IMPORT', 'SYSTEM', gw."companyAccountId", gw."createdAt", gw."updatedAt"
FROM "GeneratedWebsite" gw
WHERE gw."companyAccountId" IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM "WebsitePromptVersion" wpv WHERE wpv."generatedWebsiteId" = gw."id");
