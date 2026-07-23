import { NextResponse } from 'next/server';
import { getWhatsAppCredentials } from '@/lib/whatsapp';

export async function GET() {
  const { token, phoneNumberId } = await getWhatsAppCredentials();

  const isConfigured = Boolean(token && phoneNumberId);

  return NextResponse.json({
    configured: isConfigured,
    provider: 'Meta WhatsApp Cloud API',
    phoneNumberId: phoneNumberId ? `***${phoneNumberId.slice(-4)}` : null,
    verifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN || 'jasmine_secret_verify_token'
  });
}
