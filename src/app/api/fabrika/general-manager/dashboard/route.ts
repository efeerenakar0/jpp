import { NextResponse } from 'next/server';

import { getDigitalManagerDashboard } from '@/lib/digital-manager/dashboard';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const dashboard = await getDigitalManagerDashboard(
      principal.account.id,
      principal.type === 'OWNER'
        ? { type: 'OWNER', memberId: null }
        : { type: 'EMPLOYEE', memberId: principal.member.id }
    );
    return NextResponse.json(dashboard);
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[Digital Manager Dashboard GET Error]:', error);
    return NextResponse.json(
      { error: 'Operasyon görünümü yüklenemedi.' },
      { status: 500 }
    );
  }
}
