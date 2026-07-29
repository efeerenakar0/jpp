import { NextResponse } from 'next/server';

import { generateVerifiedDailyManagerSummary } from '@/lib/digital-manager/summary';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaOwner,
} from '@/lib/fabrika-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const summary = await generateVerifiedDailyManagerSummary(
      principal.account.id
    );
    return NextResponse.json({ summary });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json({ error: error.message }, { status: 403 });
    }
    console.error('[Digital Manager Summary Error]:', error);
    return NextResponse.json(
      { error: 'Doğrulanmış günlük özet üretilemedi.' },
      { status: 500 }
    );
  }
}
