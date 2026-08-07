DO $$
BEGIN
  CREATE TYPE "CrmPropertyListingType" AS ENUM ('SALE', 'RENT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "CrmProperty"
  ADD COLUMN IF NOT EXISTS "listingType" "CrmPropertyListingType" NOT NULL DEFAULT 'SALE';
