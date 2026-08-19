import { NextResponse } from 'next/server';

import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { parseTcmbRates } from '@/lib/tcmb-exchange-rates';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET() {
  try {
    await requireFabrikaPrincipal();
    const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml', {
      headers: {
        Accept: 'application/xml,text/xml;q=0.9,*/*;q=0.8',
        'User-Agent': 'Business CEO AI/1.0',
      },
      next: { revalidate: 7_200 },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      throw new Error('TCMB kur servisine ulaşılamadı.');
    }

    const parsed = parseTcmbRates(await response.text());
    return NextResponse.json(
      {
        success: true,
        source: 'TCMB',
        publishedDate: parsed.publishedDate,
        fetchedAt: new Date().toISOString(),
        rates: parsed.rates,
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { success: false, error: 'Oturum bulunamadı.' },
        { status: 401 }
      );
    }

    console.error('Exchange rates GET error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Güncel kurlar şu anda alınamıyor. Lütfen biraz sonra tekrar deneyin.',
      },
      { status: 503 }
    );
  }
}
