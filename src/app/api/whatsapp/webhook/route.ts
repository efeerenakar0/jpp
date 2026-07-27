import { createHmac, timingSafeEqual } from 'node:crypto';
import { after, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  mapMetaDeliveryStatus,
  parseMetaTimestamp,
} from '@/lib/assistant-messaging';
import { processIncomingWhatsAppMessage } from '@/lib/whatsapp-incoming';

export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const maxDuration = 60;

function validMetaSignature(rawBody: string, signature: string | null) {
  const secret = process.env.META_APP_SECRET;
  if (!secret) return true;
  if (!signature?.startsWith('sha256=')) return false;
  const expected = Buffer.from(
    createHmac('sha256', secret).update(rawBody).digest('hex'),
    'hex'
  );
  const actual = Buffer.from(signature.slice(7), 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const expected = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  if (
    expected &&
    params.get('hub.mode') === 'subscribe' &&
    params.get('hub.verify_token') === expected &&
    params.get('hub.challenge')
  ) {
    return new Response(params.get('hub.challenge'), {
      status: 200,
      headers: { 'Content-Type': 'text/plain' },
    });
  }
  return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!validMetaSignature(rawBody, request.headers.get('x-hub-signature-256'))) {
    return NextResponse.json({ error: 'Geçersiz imza.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ status: 'invalid_payload' }, { status: 400 });
  }
  if (body.object !== 'whatsapp_business_account') {
    return NextResponse.json({ status: 'ignored' });
  }

  const entry = Array.isArray(body.entry) ? body.entry[0] : null;
  const changes =
    entry && typeof entry === 'object' && Array.isArray(entry.changes)
      ? entry.changes
      : [];
  const change = changes[0] as { value?: Record<string, unknown> } | undefined;
  const value = change?.value || {};
  const metadata = (value.metadata || {}) as { phone_number_id?: string };
  const phoneNumberId = String(metadata.phone_number_id || '');
  let config = phoneNumberId
    ? await prisma.whatsAppConfig.findFirst({ where: { phoneNumberId } })
    : null;

  if (!config && phoneNumberId === process.env.WHATSAPP_PHONE_NUMBER_ID) {
    const jasmine = await prisma.companyAccount.findUnique({
      where: { slug: 'jasmine-group' },
      select: { id: true },
    });
    if (jasmine) {
      config = await prisma.whatsAppConfig.findUnique({
        where: { companyAccountId: jasmine.id },
      });
    }
  }
  if (!config?.companyAccountId) {
    return NextResponse.json({ status: 'unmapped_phone' }, { status: 202 });
  }

  const statuses = Array.isArray(value.statuses) ? value.statuses : [];
  if (statuses.length) {
    after(async () => {
      for (const raw of statuses) {
        const status = raw as {
          id?: string;
          status?: string;
          timestamp?: string;
          errors?: Array<{ title?: string; message?: string }>;
        };
        const providerMessageId = String(status.id || '');
        const deliveryStatus = mapMetaDeliveryStatus(
          String(status.status || '')
        );
        if (!providerMessageId || !deliveryStatus) continue;
        const at = parseMetaTimestamp(status.timestamp);
        const errorMessage =
          status.errors
            ?.map((item) => item.message || item.title)
            .filter(Boolean)
            .join(' · ') || null;
        await Promise.all([
          prisma.conversationMessage.updateMany({
            where: {
              providerMessageId,
              conversation: {
                companyAccountId: config!.companyAccountId!,
              },
            },
            data: {
              deliveryStatus,
              ...(deliveryStatus === 'DELIVERED' ? { deliveredAt: at } : {}),
              ...(deliveryStatus === 'FAILED'
                ? { failedAt: at, errorMessage }
                : {}),
            },
          }),
          prisma.whatsAppMessage.updateMany({
            where: {
              companyAccountId: config!.companyAccountId!,
              providerMessageId,
            },
            data: { status: deliveryStatus },
          }),
        ]);
      }
    });
  }

  const messages = Array.isArray(value.messages) ? value.messages : [];
  const message = messages[0] as
    | {
        id?: string;
        from?: string;
        type?: string;
        text?: { body?: string };
        image?: { caption?: string };
      }
    | undefined;
  if (!message) {
    return NextResponse.json({ status: 'accepted' });
  }
  const contacts = Array.isArray(value.contacts) ? value.contacts : [];
  const contact = contacts[0] as { profile?: { name?: string } } | undefined;
  const messageType = String(message.type || 'unknown');
  const text =
    messageType === 'text'
      ? String(message.text?.body || '')
      : messageType === 'image'
        ? String(message.image?.caption || 'Müşteri bir görsel gönderdi.')
        : `[${messageType} mesajı alındı]`;
  const input = {
    companyAccountId: config.companyAccountId,
    provider: 'META' as const,
    fromPhone: String(message.from || ''),
    contactName:
      String(contact?.profile?.name || '').trim() ||
      `WhatsApp ${String(message.from || '').slice(-4)}`,
    text,
    providerMessageId: String(message.id || ''),
    messageType,
  };
  after(async () => {
    await processIncomingWhatsAppMessage(input).catch((error) => {
      console.error('[Meta WhatsApp Webhook Worker Error]:', error);
    });
  });

  return NextResponse.json({ status: 'accepted' });
}
