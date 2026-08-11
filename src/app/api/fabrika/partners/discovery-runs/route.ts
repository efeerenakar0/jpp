import { NextResponse } from 'next/server';
import { PartnerSourceType } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { fetchSignedPartnerFeed, parsePartnerCsv } from '@/lib/partner-outreach/provider';
import { discoverOpenDirectoryPartners } from '@/lib/partner-outreach/open-directory';
import { importPartnerOrganizations } from '@/lib/partner-outreach/service';

export const maxDuration = 60;

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
      countryCode: input.countryCode.toUpperCase(), status: 'RUNNING', requestedLimit: 30,
      startedAt: new Date(), createdByType: principal.type, createdById: principal.account.id,
    } });
    try {
      const candidates = input.providerKey === 'manual_csv'
        ? parsePartnerCsv(input.csv)
        : input.providerKey === 'signed_feed'
          ? (await fetchSignedPartnerFeed(input.feedUrl, input.feedSignature)).items
          : await discoverOpenDirectoryPartners(input.countryCode, 30);
      const matching = candidates.filter((candidate) => candidate.countryCode === input.countryCode.toUpperCase());
      const result = await importPartnerOrganizations({
        companyAccountId: principal.account.id,
        runId: run.id,
        providerKey: input.providerKey === 'authorized_directory' ? 'openstreetmap_overpass' : input.providerKey,
        sourceType:
          input.providerKey === 'manual_csv'
            ? PartnerSourceType.MANUAL_CSV
            : input.providerKey === 'signed_feed'
              ? PartnerSourceType.PARTNER_FEED
              : PartnerSourceType.AUTHORIZED_DIRECTORY_API,
        candidates: matching,
      });
      return NextResponse.json({ success: true, runId: run.id, ...result }, { status: 202 });
    } catch (error) {
      await prisma.partnerDiscoveryRun.update({ where: { id: run.id }, data: { status: 'FAILED', completedAt: new Date(), errorCode: 'IMPORT_FAILED', errorMessage: error instanceof Error ? error.message.slice(0, 1000) : 'İçe aktarma başarısız.' } });
      throw error;
    }
  } catch (error) { return partnerApiError(error); }
}
