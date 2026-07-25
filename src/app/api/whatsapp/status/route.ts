import { NextResponse } from 'next/server';
import { getWhatsAppCredentials } from '@/lib/whatsapp';

export async function GET() {
  try {
    const { token, phoneNumberId } = await getWhatsAppCredentials();

    return NextResponse.json({
      configured: Boolean(token && phoneNumberId),
      provider: 'Meta WhatsApp Cloud API',
      phoneNumberId: phoneNumberId ? `***${phoneNumberId.slice(-4)}` : null,
    });
  } catch {
    return NextResponse.json({
      configured: false,
      provider: 'Meta WhatsApp Cloud API',
      phoneNumberId: null,
    });
  }
}
