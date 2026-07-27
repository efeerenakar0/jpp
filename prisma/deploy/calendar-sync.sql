ALTER TABLE "CrmTask"
  ADD COLUMN IF NOT EXISTS "endAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "allDay" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "calendarSource" TEXT NOT NULL DEFAULT 'JASMINE',
  ADD COLUMN IF NOT EXISTS "calendarSyncStatus" TEXT NOT NULL DEFAULT 'LOCAL',
  ADD COLUMN IF NOT EXISTS "googleCalendarId" TEXT,
  ADD COLUMN IF NOT EXISTS "googleEventId" TEXT,
  ADD COLUMN IF NOT EXISTS "googleUpdatedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "calendarSyncedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "CrmTask_companyAccountId_googleCalendarId_googleEventId_key"
  ON "CrmTask"("companyAccountId", "googleCalendarId", "googleEventId");

CREATE TABLE IF NOT EXISTS "GoogleCalendarConnection" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "connectedByMemberId" TEXT,
  "email" TEXT,
  "calendarId" TEXT NOT NULL DEFAULT 'primary',
  "encryptedAccessToken" TEXT NOT NULL,
  "encryptedRefreshToken" TEXT NOT NULL,
  "accessTokenExpiresAt" TIMESTAMP(3),
  "scope" TEXT,
  "syncToken" TEXT,
  "lastSyncedAt" TIMESTAMP(3),
  "lastSyncStatus" TEXT NOT NULL DEFAULT 'CONNECTED',
  "lastSyncError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GoogleCalendarConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "GoogleCalendarConnection_companyAccountId_key"
  ON "GoogleCalendarConnection"("companyAccountId");
CREATE INDEX IF NOT EXISTS "GoogleCalendarConnection_companyAccountId_lastSyncStatus_idx"
  ON "GoogleCalendarConnection"("companyAccountId", "lastSyncStatus");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'GoogleCalendarConnection_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "GoogleCalendarConnection"
      ADD CONSTRAINT "GoogleCalendarConnection_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "CalendarSyncLog" (
  "id" TEXT NOT NULL,
  "companyAccountId" TEXT NOT NULL,
  "direction" TEXT NOT NULL DEFAULT 'TWO_WAY',
  "status" TEXT NOT NULL,
  "pulledCount" INTEGER NOT NULL DEFAULT 0,
  "pushedCount" INTEGER NOT NULL DEFAULT 0,
  "conflictCount" INTEGER NOT NULL DEFAULT 0,
  "errorMessage" TEXT,
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  CONSTRAINT "CalendarSyncLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CalendarSyncLog_companyAccountId_startedAt_idx"
  ON "CalendarSyncLog"("companyAccountId", "startedAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'CalendarSyncLog_companyAccountId_fkey'
  ) THEN
    ALTER TABLE "CalendarSyncLog"
      ADD CONSTRAINT "CalendarSyncLog_companyAccountId_fkey"
      FOREIGN KEY ("companyAccountId") REFERENCES "CompanyAccount"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
