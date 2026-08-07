import {
  CrmPropertyStatus,
  Prisma,
  PropertyMediaType,
  StudioVideoJobStatus,
} from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { isPlatformTextAiReady } from '@/lib/platform-ai-readiness';
import type { MarketingCreativeAsset } from '@/lib/marketing-creative-assets';

const patchSchema = z.object({
  adCopyId: z.string().trim().min(1),
  approved: z.boolean(),
});

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const [campaigns, properties, websiteAnalyses, posterAssets, videoAssets] =
      await Promise.all([
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
      prisma.crmPropertyMedia.findMany({
        where: {
          companyAccountId: principal.account.id,
          archivedAt: null,
          mediaType: {
            in: [PropertyMediaType.POSTER, PropertyMediaType.MARKETING_ASSET],
          },
        },
        select: {
          id: true,
          propertyId: true,
          url: true,
          fileName: true,
          width: true,
          height: true,
          prompt: true,
          createdAt: true,
          property: {
            select: { id: true, title: true, referenceCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.studioVideoJob.findMany({
        where: {
          companyAccountId: principal.account.id,
          status: StudioVideoJobStatus.COMPLETED,
          outputStorageKey: { not: null },
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        select: {
          id: true,
          propertyId: true,
          outputFileName: true,
          userCommand: true,
          prompt: true,
          ratio: true,
          durationSeconds: true,
          createdAt: true,
          property: {
            select: { id: true, title: true, referenceCode: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
    ]);

    const creativeAssets: MarketingCreativeAsset[] = [
      ...posterAssets.map((asset) => ({
        id: asset.id,
        kind: 'POSTER' as const,
        propertyId: asset.propertyId,
        title: asset.fileName || `${asset.property.title} posteri`,
        detail: asset.prompt,
        previewUrl: asset.url,
        downloadUrl: asset.url,
        ratio:
          asset.width && asset.height ? `${asset.width}:${asset.height}` : null,
        durationSeconds: null,
        createdAt: asset.createdAt.toISOString(),
        property: asset.property,
      })),
      ...videoAssets.map((asset) => {
        const artifactUrl = `/api/fabrika/studio/video/jobs/${asset.id}/artifact`;
        return {
          id: asset.id,
          kind: 'VIDEO' as const,
          propertyId: asset.propertyId,
          title: asset.outputFileName || `${asset.property.title} videosu`,
          detail: asset.userCommand || asset.prompt,
          previewUrl: artifactUrl,
          downloadUrl: artifactUrl,
          ratio: asset.ratio,
          durationSeconds: asset.durationSeconds,
          createdAt: asset.createdAt.toISOString(),
          property: asset.property,
        };
      }),
    ].sort((left, right) => right.createdAt.localeCompare(left.createdAt));

    return NextResponse.json({
      company: { name: principal.account.companyName },
      ai: {
        managedByPlatform: true,
        ready: isPlatformTextAiReady(),
      },
      campaigns,
      properties,
      websiteAnalyses,
      creativeAssets,
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
