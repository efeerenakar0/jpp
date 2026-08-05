import { CrmPropertyStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { isPlatformTextAiReady } from '@/lib/platform-ai-readiness';

const patchSchema = z.object({
  adCopyId: z.string().trim().min(1),
  approved: z.boolean(),
});

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const [campaigns, properties, websiteAnalyses] = await Promise.all([
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
      prisma.marketingWebsiteAnalysis.findMany({
        where: { companyAccountId: principal.account.id },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);
    return NextResponse.json({
      company: { name: principal.account.companyName },
      ai: {
        managedByPlatform: true,
        ready: isPlatformTextAiReady(),
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
      select: {
        id: true,
        campaignId: true,
        campaign: { select: { publicationStatus: true } },
      },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Reklam metni bulunamadı.' }, { status: 404 });
    }
    const copy = await prisma.$transaction(async (tx) => {
      const updatedCopy = await tx.adCopy.update({
        where: { id: existing.id },
        data: { approved: parsed.data.approved },
      });

      if (
        parsed.data.approved === false &&
        existing.campaignId &&
        existing.campaign?.publicationStatus !== 'DRAFT'
      ) {
        await tx.adCampaign.updateMany({
          where: {
            id: existing.campaignId,
            companyAccountId: principal.account.id,
            publicationStatus: { not: 'DRAFT' },
          },
          data: {
            publicationStatus: 'DRAFT',
            exportPackage: Prisma.JsonNull,
            exportedAt: null,
            externalPublicationUrl: null,
            publicationProofUrl: null,
            manuallyConfirmedAt: null,
            manuallyConfirmedById: null,
          },
        });
      }

      return updatedCopy;
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
