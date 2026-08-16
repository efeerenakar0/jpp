import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';
import { decryptContactPhone } from '@/lib/hunting-v2/contact-crypto';

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
        sourceAuthorization: {
          select: {
            status: true,
            allowedScopes: true,
            startsAt: true,
            expiresAt: true,
          },
        },
        listingLinks: {
          orderBy: { position: 'asc' },
          select: {
            listing: {
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
                ownerName: true,
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
                    phoneCiphertext: true,
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
        },
      },
    });

    if (!job) throw new Error('Av işi bulunamadı.');

    const now = new Date();
    const canExportFullContacts =
      job.sourceAuthorization.status === 'ACTIVE' &&
      job.sourceAuthorization.startsAt <= now &&
      (!job.sourceAuthorization.expiresAt ||
        job.sourceAuthorization.expiresAt > now) &&
      job.sourceAuthorization.allowedScopes.includes('CONTACT_READ');
    const { listingLinks, sourceAuthorization: _sourceAuthorization, ...jobSummary } =
      job;
    void _sourceAuthorization;
    const exportedListings = listingLinks.map(({ listing }) => listing).map(
      ({ ownerName, contacts, ...listing }) => ({
        ...listing,
        sellerName: ownerName,
        contacts: contacts.map(({ phoneCiphertext, ...contact }) => {
          if (
            !canExportFullContacts ||
            contact.sourceType !== 'AUTHORIZED_SOURCE' ||
            !phoneCiphertext
          ) {
            return contact;
          }
          try {
            return {
              ...contact,
              phone: `+${decryptContactPhone(phoneCiphertext)}`,
            };
          } catch {
            return contact;
          }
        }),
      })
    );
    const payload = {
      schemaVersion: 2,
      product: 'Business AI Portföy Uzmanı',
      exportedAt: new Date().toISOString(),
      job: jobSummary,
      listings: exportedListings,
    };
    const safeId = job.id.replace(/[^a-zA-Z0-9_-]/g, '-');

    return new Response(JSON.stringify(payload, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="business-ai-portfoy-uzmani-${safeId}.json"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (error) {
    return huntingApiError(error);
  }
}
