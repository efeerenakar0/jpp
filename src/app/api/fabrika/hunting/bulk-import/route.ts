import { NextResponse } from 'next/server';
import {
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { huntingApiError, principalActor } from '@/lib/hunting-v2/api';
import {
  parseHuntingImportPackage,
  parseHuntingImportPayload,
} from '@/lib/hunting-v2/import-package';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

async function readImport(request: Request) {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData();
    const file = formData.get('file');
    if (!(file instanceof File)) {
      throw new Error('Yüklenecek ZIP veya JSON dosyası seçilmedi.');
    }
    return parseHuntingImportPackage({
      fileName: file.name,
      mimeType: file.type,
      bytes: new Uint8Array(await file.arrayBuffer()),
    });
  }
  return parseHuntingImportPayload(await request.json());
}

function sourceProvider(sourceUrl: string) {
  try {
    return new URL(sourceUrl).hostname
      .toLocaleLowerCase('tr-TR')
      .endsWith('sahibinden.com')
      ? ('SAHIBINDEN' as const)
      : ('FIXTURE' as const);
  } catch {
    return 'FIXTURE' as const;
  }
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const actor = principalActor(principal);
    enforceHuntingRateLimit(
      `bulk-import:${principal.account.id}:${actor.key}`,
      { limit: 5, windowMs: 60_000 }
    );
    const imported = await readImport(request);
    let added = 0;
    let skipped = 0;
    for (const item of imported.listings) {
      const sourceListingId = item.listingId || null;
      const sourceUrl =
        item.url ||
        item.sourceUrl ||
        `https://manual.jasmine.local/${sourceListingId || crypto.randomUUID()}`;
      const provider = sourceProvider(sourceUrl);
      const existing = await prisma.huntedListing.findFirst({
        where: {
          companyAccountId: principal.account.id,
          OR: [
            { sourceUrl },
            ...(sourceListingId
              ? [
                  {
                    sourceProvider: provider,
                    sourceListingId,
                  },
                ]
              : []),
          ],
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.huntedListing.create({
        data: {
          companyAccountId: principal.account.id,
          sourceProvider: provider,
          sourceListingId,
          sourceUrl,
          title: item.title,
          price: item.price || null,
          location: item.location || null,
          roomCount: item.roomCount || null,
          area: item.area || null,
          ownerName: item.ownerName || null,
          ownerPhone: null,
          ownerPhoneNormalized: null,
          imageUrl: item.imageUrl || null,
          status: 'YELLOW',
          acquisitionStatus: 'DISCOVERED',
          rawData: JSON.stringify(item),
        },
      });
      added += 1;
    }
    return NextResponse.json({
      success: true,
      added,
      skipped,
      sourceFile: imported.sourceFile,
      ignoredSensitiveFieldCount: imported.ignoredSensitiveFieldCount,
    });
  } catch (error) {
    console.error(
      'Hunting import error:',
      error instanceof Error ? error.message : error
    );
    return huntingApiError(error);
  }
}
