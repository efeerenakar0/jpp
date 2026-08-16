import 'server-only';

import { Prisma } from '@prisma/client';

import type { DeveloperSiteContent, DeveloperThemeId } from './developer-site';
import prisma from './prisma';

export type DeveloperSiteSettingsRecord = {
  selectedTheme: string;
  siteContent: unknown;
  aiUsageDay: Date | null;
  aiUsageCount: number;
};

export async function readDeveloperSiteSettings(companyAccountId: string) {
  const rows = await prisma.$queryRaw<DeveloperSiteSettingsRecord[]>(Prisma.sql`
    SELECT
      "selectedTheme",
      "siteContent",
      "aiUsageDay",
      "aiUsageCount"
    FROM "DeveloperWorkspace"
    WHERE "companyAccountId" = ${companyAccountId}
    LIMIT 1
  `);
  return rows[0] ?? null;
}

export async function saveDeveloperSiteSettings(input: {
  companyAccountId: string;
  selectedTheme: DeveloperThemeId;
  siteContent: DeveloperSiteContent;
}) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "DeveloperWorkspace"
    SET
      "selectedTheme" = ${input.selectedTheme},
      "siteContent" = ${JSON.stringify(input.siteContent)}::jsonb,
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "companyAccountId" = ${input.companyAccountId}
  `);
}

export async function saveDeveloperAiUsage(input: {
  companyAccountId: string;
  day: Date;
  count: number;
}) {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE "DeveloperWorkspace"
    SET
      "aiUsageDay" = ${input.day},
      "aiUsageCount" = ${input.count},
      "updatedAt" = CURRENT_TIMESTAMP
    WHERE "companyAccountId" = ${input.companyAccountId}
  `);
}
