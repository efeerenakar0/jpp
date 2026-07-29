import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/fabrika/hunting/listings/[id]'>
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { id } = await context.params;
    const listing = await prisma.huntedListing.findFirst({
      where: { id, companyAccountId: principal.account.id },
      select: {
        id: true,
        huntJobId: true,
        sourceProvider: true,
        sourceListingId: true,
        sourceUrl: true,
        title: true,
        price: true,
        priceAmount: true,
        currency: true,
        listingPublishedAt: true,
        category: true,
        subcategory: true,
        sellerType: true,
        descriptionText: true,
        sanitizedDescriptionHtml: true,
        province: true,
        district: true,
        neighborhood: true,
        street: true,
        latitude: true,
        longitude: true,
        addressPrecision: true,
        acquisitionStatus: true,
        completenessScore: true,
        attributesJson: true,
        firstSeenAt: true,
        lastSeenAt: true,
        removedAt: true,
        images: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            order: true,
            sourceUrl: true,
            storageKey: true,
            checksum: true,
            mimeType: true,
            width: true,
            height: true,
            byteSize: true,
          },
        },
        contacts: {
          orderBy: { updatedAt: 'desc' },
          select: {
            id: true,
            maskedPhone: true,
            subjectRole: true,
            sourceType: true,
            purpose: true,
            sourcePurposeAllowed: true,
            verificationStatus: true,
            legalBasisStatus: true,
            retentionUntil: true,
            quarantinedAt: true,
            quarantineReason: true,
            doNotContactAt: true,
            consents: {
              where: {
                companyAccountId: principal.account.id,
                channel: 'WHATSAPP',
                purpose: 'SALES_AUTHORITY_DISCUSSION',
              },
              orderBy: { updatedAt: 'desc' },
              take: 1,
              select: {
                status: true,
                iysStatus: true,
                updatedAt: true,
              },
            },
            approvals: {
              where: {
                companyAccountId: principal.account.id,
                channel: 'WHATSAPP',
                purpose: 'SALES_AUTHORITY_DISCUSSION',
                status: 'APPROVED',
                revokedAt: null,
              },
              orderBy: { approvedAt: 'desc' },
              take: 1,
              select: { approvedAt: true, revokedAt: true },
            },
            policyDecisions: {
              orderBy: { evaluatedAt: 'desc' },
              take: 1,
              select: {
                allowed: true,
                reasonCodes: true,
                evaluatedAt: true,
              },
            },
          },
        },
      },
    });
    if (!listing) throw new Error('İlan bulunamadı.');
    return NextResponse.json(listing);
  } catch (error) {
    return huntingApiError(error);
  }
}
