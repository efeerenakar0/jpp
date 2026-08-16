import { NextResponse } from 'next/server';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { huntingApiError } from '@/lib/hunting-v2/api';
import { listHuntingQuotaSnapshots } from '@/lib/hunting-v2/job-service';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    if (principal.type !== 'OWNER') {
      throw new Error('Avci kullanim haklarini yalniz patron goruntuleyebilir.');
    }
    const items = await listHuntingQuotaSnapshots(principal.account.id);
    return NextResponse.json({
      periodStart: items[0]?.periodStart || null,
      periodEnd: items[0]?.periodEnd || null,
      items,
    });
  } catch (error) {
    return huntingApiError(error);
  }
}
