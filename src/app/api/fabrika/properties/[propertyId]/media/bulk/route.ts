import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import {
  archivePropertyMedia,
  reorderPropertyMedia,
} from '@/lib/property-media';
import { propertyMediaHttpError } from '@/lib/property-media-http';

const bodySchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('archive'),
    mediaIds: z.array(z.string().min(1)).min(1).max(50),
  }),
  z.object({
    action: z.literal('reorder'),
    mediaIds: z.array(z.string().min(1)).min(1).max(100),
  }),
]);

type Context = { params: Promise<{ propertyId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { propertyId } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Toplu medya işlemi geçersiz.' },
        { status: 400 }
      );
    }
    const actor = {
      companyAccountId: principal.account.id,
      memberId: principal.member?.id ?? null,
    };
    if (parsed.data.action === 'archive') {
      const result = await archivePropertyMedia(
        actor,
        propertyId,
        parsed.data.mediaIds
      );
      return NextResponse.json({ success: true, ...result });
    }
    await reorderPropertyMedia(actor, propertyId, parsed.data.mediaIds);
    return NextResponse.json({ success: true });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
