import { AiProvider, CrmPropertyStatus } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { DEFAULT_OPENROUTER_MODEL } from '@/lib/marketing-ai';

const patchSchema = z.object({
  adCopyId: z.string().trim().min(1),
  approved: z.boolean(),
});

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const [campaigns, properties, credential, websiteAnalyses] = await Promise.all([
      prisma.adCampaign.findMany({
        where: { companyAccountId: principal.account.id },
        include: {
          property: {
            select: {
              id: true,
              title: true,
              location: true,
              price: true,
              imageUrl: true,
              referenceCode: true,
            },
          },
          adCopies: { orderBy: { platform: 'asc' } },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.crmProperty.findMany({
        where: {
          companyAccountId: principal.account.id,
          status: { in: [CrmPropertyStatus.ACTIVE, CrmPropertyStatus.RESERVED] },
        },
        select: {
          id: true,
          title: true,
          location: true,
          price: true,
          imageUrl: true,
          referenceCode: true,
          status: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 100,
      }),
      prisma.companyAiCredential.findUnique({
        where: {
          companyAccountId_provider: {
            companyAccountId: principal.account.id,
            provider: AiProvider.OPENROUTER,
          },
        },
        select: { active: true, keyHint: true, model: true },
      }),
      prisma.marketingWebsiteAnalysis.findMany({
        where: { companyAccountId: principal.account.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return NextResponse.json({
      company: { name: principal.account.companyName },
      permissions: { canManageSecrets: principal.permissions.canManageSecrets },
      ai: {
        configured: Boolean(credential),
        active: credential?.active || false,
        keyHint: credential?.keyHint || null,
        model: credential?.model || DEFAULT_OPENROUTER_MODEL,
        fallbackAvailable: Boolean(process.env.GROQ_API_KEY),
      },
      campaigns,
      properties,
      websiteAnalyses,
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[Marketing Campaigns GET]:', error);
    return NextResponse.json({ error: 'Kampanyalar alınamadı.' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Onay bilgisi geçersiz.' }, { status: 400 });
    }
    const existing = await prisma.adCopy.findFirst({
      where: {
        id: parsed.data.adCopyId,
        campaign: { companyAccountId: principal.account.id },
      },
      select: { id: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Reklam metni bulunamadı.' }, { status: 404 });
    }
    const copy = await prisma.adCopy.update({
      where: { id: existing.id },
      data: { approved: parsed.data.approved },
    });
    return NextResponse.json(copy);
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[Marketing Campaigns PATCH]:', error);
    return NextResponse.json({ error: 'Onay durumu güncellenemedi.' }, { status: 500 });
  }
}
