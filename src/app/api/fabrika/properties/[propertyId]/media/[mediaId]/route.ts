import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import {
  archivePropertyMedia,
  updatePropertyMedia,
} from '@/lib/property-media';
import { propertyMediaHttpError } from '@/lib/property-media-http';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Context = {
  params: Promise<{ propertyId: string; mediaId: string }>;
};

const patchSchema = z
  .object({
    isCover: z.boolean().optional(),
    sortOrder: z.number().int().min(0).max(100_000).optional(),
    usageRightsStatus: z
      .enum(['CONFIRMED', 'UNVERIFIED', 'RESTRICTED'])
      .optional(),
    fileName: z.string().trim().min(1).max(160).optional(),
  })
  .strict();

function actorFrom(
  principal: Awaited<ReturnType<typeof requireFabrikaPrincipal>>
) {
  return {
    companyAccountId: principal.account.id,
    memberId: principal.member?.id ?? null,
  };
}

export async function PATCH(request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { propertyId, mediaId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Görsel güncelleme bilgileri geçersiz.',
        },
        { status: 400 }
      );
    }
    const item = await updatePropertyMedia(
      actorFrom(principal),
      propertyId,
      mediaId,
      parsed.data
    );
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}

export async function DELETE(_request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { propertyId, mediaId } = await context.params;
    const result = await archivePropertyMedia(
      actorFrom(principal),
      propertyId,
      [mediaId]
    );
    return NextResponse.json({ success: true, ...result });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
