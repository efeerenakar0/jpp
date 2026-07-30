import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import { processStudioBatchItem } from '@/lib/studio-batches';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 300;

type Context = {
  params: Promise<{ batchId: string; itemId: string }>;
};

export async function POST(_request: Request, context: Context) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { batchId, itemId } = await context.params;
    const item = await processStudioBatchItem({
      actor: {
        companyAccountId: principal.account.id,
        memberId: principal.member?.id ?? null,
      },
      batchId,
      itemId,
    });
    return NextResponse.json({ success: true, item });
  } catch (error) {
    return propertyMediaHttpError(error);
  }
}
