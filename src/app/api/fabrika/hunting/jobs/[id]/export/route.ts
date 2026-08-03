import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  context: RouteContext<'/api/fabrika/hunting/jobs/[id]/export'>
) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { id } = await context.params;
    const job = await prisma.huntJob.findFirst({
      where: { id, companyAccountId: principal.account.id },
      select: {
        id: true,
        provider: true,
        searchUrl: true,
        status: true,
        totalDiscovered: true,
        totalCompleted: true,
        totalPartial: true,
        totalFailed: true,
        createdAt: true,
        startedAt: true,
        completedAt: true,
        listings: {
          orderBy: [{ sourceListingId: 'asc' }, { id: 'asc' }],
          select: {
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
            location: true,
            roomCount: true,
            area: true,
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
                order: true,
                sourceUrl: true,
                storageKey: true,
                mimeType: true,
                width: true,
                height: true,
                byteSize: true,
              },
            },
            contacts: {
              orderBy: { updatedAt: 'desc' },
              select: {
                maskedPhone: true,
                subjectRole: true,
                sourceType: true,
                verificationStatus: true,
                legalBasisStatus: true,
              },
            },
          },
        },
      },
    });

    if (!job) throw new Error('Av işi bulunamadı.');

    const { listings, ...jobSummary } = job;
    const payload = {
      schemaVersion: 1,
      product: 'Business AI Portföy Bulucu',
      exportedAt: new Date().toISOString(),
      job: jobSummary,
      listings,
    };
    const safeId = job.id.replace(/[^a-zA-Z0-9_-]/g, '-');

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="business-ai-portfoy-bulucu-${safeId}.json"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return huntingApiError(error);
  }
}
