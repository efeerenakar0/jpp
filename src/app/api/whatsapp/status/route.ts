import { NextResponse } from 'next/server';
import {
  ensureCompanyWhatsAppConfig,
  serializeCompanyWhatsAppStatus,
} from '@/lib/company-whatsapp';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';

export async function GET() {
  try {
    const principal = await requireFabrikaPrincipal();
    const config = await ensureCompanyWhatsAppConfig(principal.account.id);
    return NextResponse.json(serializeCompanyWhatsAppStatus(config));
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    return NextResponse.json(
      { error: 'WhatsApp durumu alınamadı.' },
      { status: 503 }
    );
  }
}
