import { AdPublicationStatus, Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import {
  assertAdPublicationTransition,
  assertCampaignReadyForPublication,
  buildAdExportPackage,
  canClaimManualPublication,
} from '@/lib/ad-publication';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const httpUrl = z
  .string()
  .trim()
  .url('Geçerli bir dış platform bağlantısı girin.')
  .max(2_048)
  .refine((value) => ['http:', 'https:'].includes(new URL(value).protocol), {
    message: 'Yalnızca HTTP veya HTTPS bağlantısı kullanılabilir.',
  });

const actionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('PREPARE') }),
  z.object({ action: z.literal('EXPORT') }),
  z.object({
    action: z.literal('CONFIRM'),
    externalUrl: httpUrl.optional(),
    proofUrl: httpUrl.optional(),
  }),
]);

const campaignInclude = {
  property: {
    select: {
      id: true,
      title: true,
      referenceCode: true,
      location: true,
      price: true,
    },
  },
  adCopies: {
    orderBy: { platform: 'asc' as const },
    select: {
      approved: true,
      platform: true,
      headline: true,
      body: true,
      callToAction: true,
      targetUrl: true,
    },
  },
} satisfies Prisma.AdCampaignInclude;

async function loadCampaign(companyAccountId: string, campaignId: string) {
  return prisma.adCampaign.findFirst({
    where: { id: campaignId, companyAccountId },
    include: campaignInclude,
  });
}

function responsePayload<T>(campaign: T) {
  return { success: true, campaign };
}

export async function GET(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { campaignId } = await context.params;
    const campaign = await loadCampaign(principal.account.id, campaignId);

    if (!campaign) {
      return NextResponse.json(
        { error: 'Kampanya bulunamadı.' },
        { status: 404 },
      );
    }

    const download = new URL(request.url).searchParams.get('download') === '1';
    if (!download) return NextResponse.json(responsePayload(campaign));

    if (
      !campaign.exportPackage ||
      !['EXPORTED', 'MANUALLY_CONFIRMED'].includes(campaign.publicationStatus)
    ) {
      return NextResponse.json(
        { error: 'Yayın paketi henüz dışa aktarılmadı.' },
        { status: 409 },
      );
    }

    return NextResponse.json(campaign.exportPackage, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Disposition': `attachment; filename="business-ceo-ai-${campaign.id}-yayin-paketi.json"`,
      },
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[Marketing Publication GET]:', error);
    return NextResponse.json(
      { error: 'Yayın paketi alınamadı.' },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ campaignId: string }> },
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = actionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.issues[0]?.message || 'Yayın işlemi geçersiz.' },
        { status: 400 },
      );
    }

    const { campaignId } = await context.params;
    const campaign = await loadCampaign(principal.account.id, campaignId);
    if (!campaign) {
      return NextResponse.json(
        { error: 'Kampanya bulunamadı.' },
        { status: 404 },
      );
    }

    const action = parsed.data.action;
    const targetStatus: AdPublicationStatus =
      action === 'PREPARE'
        ? 'READY_TO_PUBLISH'
        : action === 'EXPORT'
          ? 'EXPORTED'
          : 'MANUALLY_CONFIRMED';

    if (campaign.publicationStatus === targetStatus) {
      return NextResponse.json(responsePayload(campaign));
    }

    let exportPackage: ReturnType<typeof buildAdExportPackage> | null = null;
    const evidence =
      action === 'CONFIRM'
        ? {
            externalUrl: parsed.data.externalUrl || null,
            proofUrl: parsed.data.proofUrl || null,
          }
        : { externalUrl: null, proofUrl: null };

    if (action === 'PREPARE') {
      assertCampaignReadyForPublication(campaign);
    } else if (action === 'EXPORT') {
      exportPackage = buildAdExportPackage(campaign);
    } else if (!canClaimManualPublication(evidence)) {
      return NextResponse.json(
        { error: 'Manuel yayın doğrulaması için dış platform bağlantısı veya ekran kanıtı gerekir.' },
        { status: 400 },
      );
    }

    assertAdPublicationTransition(
      campaign.publicationStatus,
      targetStatus,
      evidence,
    );

    const now = new Date();
    const data: Prisma.AdCampaignUpdateManyMutationInput =
      action === 'PREPARE'
        ? {
            publicationStatus: targetStatus,
            exportPackage: Prisma.JsonNull,
            exportedAt: null,
            externalPublicationUrl: null,
            publicationProofUrl: null,
            manuallyConfirmedAt: null,
            manuallyConfirmedById: null,
          }
        : action === 'EXPORT'
          ? {
              publicationStatus: targetStatus,
              exportPackage: exportPackage as Prisma.InputJsonValue,
              exportedAt: now,
              externalPublicationUrl: null,
              publicationProofUrl: null,
              manuallyConfirmedAt: null,
              manuallyConfirmedById: null,
            }
          : {
              publicationStatus: targetStatus,
              externalPublicationUrl: evidence.externalUrl,
              publicationProofUrl: evidence.proofUrl,
              manuallyConfirmedAt: now,
              manuallyConfirmedById:
                principal.type === 'EMPLOYEE'
                  ? principal.member.id
                  : principal.account.id,
            };

    const updated = await prisma.adCampaign.updateMany({
      where: {
        id: campaign.id,
        companyAccountId: principal.account.id,
        publicationStatus: campaign.publicationStatus,
      },
      data,
    });

    const latest = await loadCampaign(principal.account.id, campaign.id);
    if (!latest) {
      return NextResponse.json(
        { error: 'Kampanya güncellemeden sonra bulunamadı.' },
        { status: 409 },
      );
    }
    if (updated.count === 0 && latest.publicationStatus !== targetStatus) {
      return NextResponse.json(
        { error: 'Kampanya başka bir işlem tarafından güncellendi. Sayfayı yenileyin.' },
        { status: 409 },
      );
    }

    return NextResponse.json(responsePayload(latest));
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof Error && /yayın|poster|kanal|onay/iu.test(error.message)) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('[Marketing Publication POST]:', error);
    return NextResponse.json(
      { error: 'Yayın durumu güncellenemedi.' },
      { status: 500 },
    );
  }
}
