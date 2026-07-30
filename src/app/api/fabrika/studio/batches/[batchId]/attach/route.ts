import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { attachStudioBatchItems } from '@/lib/property-media';
import { propertyMediaHttpError } from '@/lib/property-media-http';

const bodySchema = z.object({
  propertyId: z.string().min(1),
  itemIds: z.array(z.string().min(1)).min(1).max(50).optional(),
});
type Context = { params: Promise<{ batchId: string }> };

export async function POST(request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { batchId } = await context.params;
    const parsed = bodySchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Portföye ekleme seçimi geçersiz.' },
        { status: 400 }
      );
    }
    const items = await attachStudioBatchItems({
      actor: {
        companyAccountId: principal.account.id,
        memberId: principal.member?.id ?? null,
      },
      batchId,
      propertyId: parsed.data.propertyId,
      itemIds: parsed.data.itemIds,
    });
    return NextResponse.json({ success: true, items });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
