import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  DEVELOPER_CONTENT_SECTIONS,
  DeveloperContentAIError,
  generateDeveloperSiteSection,
} from '@/lib/developer-content-ai';
import { parseDeveloperSiteContent } from '@/lib/developer-site';
import {
  readDeveloperSiteSettings,
  saveDeveloperAiUsage,
} from '@/lib/developer-site-storage';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const DAILY_ACCOUNT_LIMIT = 12;
const requestSchema = z
  .object({
    section: z.enum(DEVELOPER_CONTENT_SECTIONS),
    instruction: z.string().trim().min(3).max(2_000),
  })
  .strict();

function isSameUtcDay(left: Date | null, right: Date) {
  return Boolean(
    left &&
      left.getUTCFullYear() === right.getUTCFullYear() &&
      left.getUTCMonth() === right.getUTCMonth() &&
      left.getUTCDate() === right.getUTCDate(),
  );
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const input = requestSchema.parse(await request.json());
    const workspace = await prisma.developerWorkspace.findUnique({
      where: { companyAccountId: principal.account.id },
    });
    if (!workspace) {
      return NextResponse.json(
        { success: false, error: 'Önce site kurulumunu tamamlayın.' },
        { status: 400 },
      );
    }
    const siteSettings = await readDeveloperSiteSettings(principal.account.id);

    const now = new Date();
    const usedToday = isSameUtcDay(siteSettings?.aiUsageDay ?? null, now)
      ? siteSettings?.aiUsageCount ?? 0
      : 0;
    if (usedToday >= DAILY_ACCOUNT_LIMIT) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Bugünkü yapay zekâ yazım hakkınız doldu. Editörü kullanmaya devam edebilir veya yarın yeniden deneyebilirsiniz.',
        },
        { status: 429 },
      );
    }

    const result = await generateDeveloperSiteSection({
      brandName: workspace.brandName,
      section: input.section,
      instruction: input.instruction,
      currentContent: parseDeveloperSiteContent(
        siteSettings?.siteContent,
        workspace.brandName,
      ),
    });

    await saveDeveloperAiUsage({
      companyAccountId: principal.account.id,
      day: now,
      count: usedToday + 1,
    });

    return NextResponse.json({
      success: true,
      section: input.section,
      content: result.content,
      model: result.model,
      remaining: Math.max(0, DAILY_ACCOUNT_LIMIT - usedToday - 1),
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { success: false, error: 'Oturum gerekli.' },
        { status: 401 },
      );
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json(
        { success: false, error: 'Bu alanı yalnızca şirket patronu düzenleyebilir.' },
        { status: 403 },
      );
    }
    if (error instanceof DeveloperContentAIError) {
      return NextResponse.json(
        { success: false, error: error.message, code: error.code },
        { status: error.status },
      );
    }
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Ne istediğinizi biraz daha açık yazın.' },
        { status: 400 },
      );
    }
    return NextResponse.json(
      { success: false, error: 'Yapay zekâ isteği tamamlanamadı.' },
      { status: 500 },
    );
  }
}
