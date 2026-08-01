import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { propertyMediaHttpError } from '@/lib/property-media-http';
import { getOwnedStudioBatch } from '@/lib/studio-batches';

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
