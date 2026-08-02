ALTER TABLE "CompanyAccount"
ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'Europe/Istanbul';

ALTER TABLE "GoogleCalendarConnection"
ADD COLUMN IF NOT EXISTS "calendarTimeZone" TEXT;
