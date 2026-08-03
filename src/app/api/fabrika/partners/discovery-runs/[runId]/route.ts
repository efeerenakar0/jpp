import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { runId } = await context.params;
    const run = await prisma.partnerDiscoveryRun.findFirst({ where: { id: runId, companyAccountId: principal.account.id } });
    if (!run) throw new Error('Keşif çalışması bulunamadı.');
    return NextResponse.json({ success: true, run });
  } catch (error) { return partnerApiError(error); }
}
