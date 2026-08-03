import { NextResponse } from 'next/server';
import {
  FabrikaForbiddenError,
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { loadPortfolioVideoCatalog } from '@/lib/portfolio-video/data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const catalog = await loadPortfolioVideoCatalog(principal);
    return NextResponse.json({ success: true, ...catalog });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof FabrikaForbiddenError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 403 });
    }
    console.error('[portfolio-video] catalog_failed', {
      error: error instanceof Error ? error.name : 'UnknownError',
    });
    return NextResponse.json(
      { success: false, error: 'Video portföyleri yüklenemedi.' },
      { status: 500 }
    );
  }
}
