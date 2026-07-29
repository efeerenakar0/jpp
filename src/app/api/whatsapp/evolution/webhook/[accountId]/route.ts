import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processIncomingWhatsAppMessage } from '@/lib/whatsapp-incoming';
import { verifyWebhookSecret } from '@/lib/whatsapp-crypto';
import { recordProviderDeliveryReceipt } from '@/lib/digital-manager/message-delivery';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function eventName(value: unknown) {
  return String(value || '').toUpperCase().replace(/[.\s-]/g, '_');
}

function textFromMessage(message: Record<string, unknown>) {
  const extended = message.extendedTextMessage as { text?: string } | undefined;
  const image = message.imageMessage as { caption?: string } | undefined;
  const video = message.videoMessage as { caption?: string } | undefined;
  const document = message.documentMessage as { fileName?: string } | undefined;
  return (
    String(message.conversation || '') ||
    String(extended?.text || '') ||
    String(image?.caption || '') ||
    String(video?.caption || '') ||
    (document?.fileName ? `[Belge: ${document.fileName}]` : '') ||
    '[Desteklenmeyen WhatsApp mesajı]'
  );
}

function quotedMessageId(message: Record<string, unknown>) {
  const extended = message.extendedTextMessage as
    | { contextInfo?: { stanzaId?: string } }
    | undefined;
  const image = message.imageMessage as
    | { contextInfo?: { stanzaId?: string } }
    | undefined;
  const video = message.videoMessage as
    | { contextInfo?: { stanzaId?: string } }
    | undefined;
  return String(
    extended?.contextInfo?.stanzaId ||
      image?.contextInfo?.stanzaId ||
      video?.contextInfo?.stanzaId ||
      ''
  ).trim() || null;
}

function deliveryFromEvolution(value: unknown) {
  const status = String(value || '').toUpperCase();
  if (/FAIL|ERROR/.test(status)) return 'FAILED' as const;
  if (/READ|PLAYED/.test(status)) return 'READ' as const;
  if (/DELIVER/.test(status)) return 'DELIVERED' as const;
  if (/SENT|SERVER/.test(status)) return 'SENT' as const;
  return null;
}

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await context.params;
  const token =
    request.headers.get('x-webhook-secret') ||
    new URL(request.url).searchParams.get('token');
  const config = await prisma.whatsAppConfig.findUnique({
    where: { companyAccountId: accountId },
  });
  if (
    !config ||
    config.provider !== 'EVOLUTION' ||
    !verifyWebhookSecret(token, config.evolutionWebhookSecretHash)
  ) {
    return NextResponse.json({ error: 'Yetkisiz webhook.' }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Geçersiz gövde.' }, { status: 400 });
  }
  if (
    config.evolutionInstanceName &&
    body.instance !== config.evolutionInstanceName
  ) {
    return NextResponse.json({ error: 'Oturum eşleşmedi.' }, { status: 403 });
  }

  const event = eventName(body.event);
  const data = (body.data || {}) as Record<string, unknown>;

  if (event === 'CONNECTION_UPDATE') {
    const state = String(data.state || data.status || '').toLowerCase();
    const connected = state === 'open' || state === 'connected';
    await prisma.whatsAppConfig.update({
      where: { companyAccountId: accountId },
      data: {
        connectionStatus: connected ? 'CONNECTED' : 'DISCONNECTED',
        connectedPhone: connected
          ? String(data.wuid || data.ownerJid || '').replace(/\D/g, '') || null
          : config.connectedPhone,
        connectedProfileName:
          String(data.profileName || data.pushName || '') || null,
        lastHealthCheckAt: new Date(),
        lastConnectedAt: connected ? new Date() : config.lastConnectedAt,
        lastError: null,
      },
    });
    return NextResponse.json({ accepted: true });
  }

  if (event === 'MESSAGES_UPDATE') {
    const key = (data.key || {}) as { id?: string };
    const providerMessageId = String(key.id || data.id || '');
    const rawStatus = String(data.status || data.update || '');
    const delivery = deliveryFromEvolution(rawStatus);
    if (providerMessageId && delivery) {
      await recordProviderDeliveryReceipt({
        companyAccountId: accountId,
        provider: 'EVOLUTION',
        providerMessageId,
        status: delivery,
        rawStatus,
        idempotencyKey: [
          'evolution-ack',
          accountId,
          providerMessageId,
          delivery,
          rawStatus,
        ].join(':'),
        errorCode:
          delivery === 'FAILED' ? 'EVOLUTION_ACK_FAILED' : undefined,
        errorMessage:
          delivery === 'FAILED'
            ? String(
                data.error ||
                  'WhatsApp sağlayıcısı teslimatı reddetti.'
              )
            : undefined,
      });
    }
    return NextResponse.json({ accepted: true });
  }

  if (event !== 'MESSAGES_UPSERT') {
    return NextResponse.json({ accepted: true, ignored: true });
  }

  const key = (data.key || {}) as {
    id?: string;
    remoteJid?: string;
    fromMe?: boolean;
  };
  const remoteJid = String(key.remoteJid || '');
  if (
    key.fromMe ||
    !remoteJid ||
    remoteJid.endsWith('@g.us') ||
    remoteJid === 'status@broadcast'
  ) {
    return NextResponse.json({ accepted: true, ignored: true });
  }
  const message = (data.message || {}) as Record<string, unknown>;
  const type = Object.keys(message)[0] || 'unknown';
  const input = {
    companyAccountId: accountId,
    provider: 'EVOLUTION' as const,
    fromPhone: remoteJid,
    contactName:
      String(data.pushName || '').trim() ||
      `WhatsApp ${remoteJid.replace(/\D/g, '').slice(-4)}`,
    text: textFromMessage(message),
    providerMessageId: String(key.id || ''),
    messageType: type.replace(/Message$/, '') || 'unknown',
    quotedProviderMessageId: quotedMessageId(message),
  };
  try {
    const result = await processIncomingWhatsAppMessage(input);
    return NextResponse.json({ accepted: true, result });
  } catch (error) {
    console.error('[Evolution Webhook Processing Error]:', error);
    await prisma.whatsAppConfig.update({
      where: { companyAccountId: accountId },
      data: {
        lastError:
          error instanceof Error
            ? error.message.slice(0, 500)
            : 'Gelen mesaj işlenemedi.',
      },
    });
    return NextResponse.json(
      { error: 'Gelen mesaj güvenli biçimde işlenemedi.' },
      { status: 500 }
    );
  }
}
