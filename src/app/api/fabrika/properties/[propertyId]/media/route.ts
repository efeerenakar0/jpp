import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import {
  persistPropertyMediaFile,
  validatePropertyMediaFiles,
} from '@/lib/media-storage';
import {
  addPropertyMedia,
  assertOwnedProperty,
  listPropertyMedia,
} from '@/lib/property-media';
import { propertyMediaHttpError } from '@/lib/property-media-http';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

type Context = { params: Promise<{ propertyId: string }> };

function actorFrom(
  principal: Awaited<ReturnType<typeof requireFabrikaPrincipal>>
) {
  return {
    companyAccountId: principal.account.id,
    memberId: principal.member?.id ?? null,
  };
}

export async function GET(request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { propertyId } = await context.params;
    const url = new URL(request.url);
    const result = await listPropertyMedia(
      actorFrom(principal),
      propertyId,
      {
        includeArchived: url.searchParams.get('archived') === '1',
      }
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}

export async function POST(request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { propertyId } = await context.params;
    const actor = actorFrom(principal);
    await assertOwnedProperty(actor, propertyId);
    const formData = await request.formData();
    const files = [
      ...formData.getAll('files'),
      ...formData.getAll('images'),
      ...formData.getAll('image'),
    ].filter((value): value is File => value instanceof File);
    validatePropertyMediaFiles(files);

    const stored = [];
    for (const file of files) {
      stored.push(
        await persistPropertyMediaFile({
          companyAccountId: principal.account.id,
          propertyId,
          file,
        })
      );
    }
    const usageRightsStatus =
      formData.get('usageRightsStatus') === 'UNVERIFIED'
        ? ('UNVERIFIED' as const)
        : ('CONFIRMED' as const);
    const created = await addPropertyMedia(
      actor,
      propertyId,
      stored.map((item) => ({
        ...item,
        fingerprint: `upload:${item.checksum}`,
        usageRightsStatus,
        provenance: { uploadedFrom: 'PORTFOLIO_MEDIA_LIBRARY' },
      })),
      { makeFirstCover: formData.get('makeFirstCover') !== 'false' }
    );
    return NextResponse.json(
      { success: true, items: created },
      { status: 201 }
    );
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
