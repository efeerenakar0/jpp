import { NextResponse } from 'next/server';
import { z } from 'zod';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import { getOwnedStudioBatch } from '@/lib/studio-batches';
import prisma from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Context = { params: Promise<{ batchId: string }> };

export async function GET(_request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { batchId } = await context.params;
    const batch = await getOwnedStudioBatch(
      {
        companyAccountId: principal.account.id,
        memberId: principal.member?.id ?? null,
      },
      batchId
    );
    return NextResponse.json({ success: true, batch });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}

const patchSchema = z.object({
  title: z.string().trim().min(1).max(180),
  itemId: z.string().min(1).optional(),
});

export async function PATCH(request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { batchId } = await context.params;
    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Çalışma adı 1 ile 180 karakter arasında olmalıdır.' },
        { status: 400 }
      );
    }
    const updated = parsed.data.itemId
      ? await prisma.studioBatchItem.updateMany({
          where: {
            id: parsed.data.itemId,
            batchId,
            batch: { companyAccountId: principal.account.id },
          },
          data: { title: parsed.data.title },
        })
      : await prisma.studioBatch.updateMany({
          where: { id: batchId, companyAccountId: principal.account.id },
          data: { title: parsed.data.title },
        });
    if (!updated.count) {
      return NextResponse.json(
        { success: false, error: 'Çalışma bulunamadı.' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true, title: parsed.data.title });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
