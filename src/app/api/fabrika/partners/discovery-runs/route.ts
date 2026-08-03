import { NextResponse } from 'next/server';
import { PartnerSourceType } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { fetchSignedPartnerFeed, parsePartnerCsv } from '@/lib/partner-outreach/provider';
import { importPartnerOrganizations } from '@/lib/partner-outreach/service';

const schema = z.discriminatedUnion('providerKey', [
  z.object({ providerKey: z.literal('manual_csv'), countryCode: z.string().trim().length(2), csv: z.string().min(10).max(2_000_000) }),
  z.object({ providerKey: z.literal('signed_feed'), countryCode: z.string().trim().length(2), feedUrl: z.string().url(), feedSignature: z.string().trim().length(64) }),
  z.object({ providerKey: z.literal('authorized_directory'), countryCode: z.string().trim().length(2) }),
]);

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaOwner();
    const input = schema.parse(await request.json());
    const run = await prisma.partnerDiscoveryRun.create({ data: {
      companyAccountId: principal.account.id, providerKey: input.providerKey,
      countryCode: input.countryCode.toUpperCase(), status: 'RUNNING', requestedLimit: 25,
      startedAt: new Date(), createdByType: principal.type, createdById: principal.account.id,
    } });
    try {
      if (input.providerKey === 'authorized_directory') {
        await prisma.partnerDiscoveryRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorCode: 'PROVIDER_NOT_CONFIGURED', errorMessage: 'Yetkili canlı dizin sağlayıcısı yapılandırılmamış.' } });
        return NextResponse.json({ success: false, runId: run.id, error: 'Canlı sağlayıcı yapılandırılmamış; sahte sonuç üretilmedi.' }, { status: 503 });
      }
      const candidates = input.providerKey === 'manual_csv'
        ? parsePartnerCsv(input.csv)
        : (await fetchSignedPartnerFeed(input.feedUrl, input.feedSignature)).items;
      const matching = candidates.filter((candidate) => candidate.countryCode === input.countryCode.toUpperCase());
      const result = await importPartnerOrganizations({
        companyAccountId: principal.account.id, runId: run.id, providerKey: input.providerKey,
        sourceType: input.providerKey === 'manual_csv' ? PartnerSourceType.MANUAL_CSV : PartnerSourceType.PARTNER_FEED,
        candidates: matching,
      });
      return NextResponse.json({ success: true, runId: run.id, ...result }, { status: 202 });
    } catch (error) {
      await prisma.partnerDiscoveryRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorCode: 'IMPORT_FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'İçe aktarma başarısız.' } });
      throw error;
    }
  } catch (error) { return partnerApiError(error); }
}
