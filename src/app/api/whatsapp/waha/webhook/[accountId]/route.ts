import { after, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processIncomingWhatsAppMessage } from '@/lib/whatsapp-incoming';
import { verifyWebhookSecret } from '@/lib/whatsapp-crypto';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

function statusFromWaha(value: unknown) {
  switch (String(value || '').toUpperCase()) {
    case 'WORKING':
      return 'CONNECTED';
    case 'SCAN_QR_CODE':
      return 'WAITING_QR';
    case 'PASSKEY_REQUIRED':
      return 'PASSKEY_REQUIRED';
    case 'PASSKEY_CONFIRMATION_REQUIRED':
      return 'PASSKEY_CONFIRMATION_REQUIRED';
    case 'STARTING':
      return 'CONNECTING';
    case 'FAILED':
      return 'ERROR';
    default:
      return 'DISCONNECTED';
  }
}

function deliveryFromAck(value: unknown) {
  const status = String(value || '').toUpperCase();
  if (status === 'ERROR' || status === '-1') return 'FAILED' as const;
  if (
    status === 'DEVICE' ||
    status === 'READ' ||
    status === 'PLAYED' ||
    ['2', '3', '4'].includes(status)
  ) {
    return 'DELIVERED' as const;
  }
  if (status === 'SERVER' || status === '1') return 'SENT' as const;
  return null;
}

function payloadRecord(body: Record<string, unknown>) {
  return body.payload && typeof body.payload === 'object'
    ? (body.payload as Record<string, unknown>)
    : {};
}

function meRecord(body: Record<string, unknown>) {
  return body.me && typeof body.me === 'object'
    ? (body.me as Record<string, unknown>)
    : {};
}

function messageDetails(payload: Record<string, unknown>) {
  const data =
    payload._data && typeof payload._data === 'object'
      ? (payload._data as Record<string, unknown>)
      : {};
  const info =
    data.Info && typeof data.Info === 'object'
      ? (data.Info as Record<string, unknown>)
      : {};
  return {
    from: String(payload.from || info.Chat || info.Sender || ''),
    pushName: String(payload.pushName || info.PushName || '').trim(),
  };
}

export async function POST(
  request: Request,
  context: { params: Promise<{ accountId: string }> }
) {
  const { accountId } = await context.params;
  const token = new URL(request.url).searchParams.get('token');
  const config = await prisma.whatsAppConfig.findUnique({
    where: { companyAccountId: accountId },
  });
  if (
    !config ||
    config.provider !== 'WAHA' ||
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

  const session = String(body.session || '');
  if (
    config.evolutionInstanceName &&
    session &&
    session !== config.evolutionInstanceName
  ) {
    return NextResponse.json({ error: 'Oturum eşleşmedi.' }, { status: 403 });
  }

  const event = String(body.event || '').toLowerCase();
  const payload = payloadRecord(body);

  if (event === 'session.status') {
    const connectionStatus = statusFromWaha(payload.status || body.status);
    const me = meRecord(body);
    const phone = String(me.id || me.jid || '')
      .replace(/@.+$/, '')
      .replace(/:\d+$/, '')
      .replace(/\D/g, '');
    await prisma.whatsAppConfig.update({
      where: { companyAccountId: accountId },
      data: {
        connectionStatus,
        connectedPhone: phone || config.connectedPhone,
        connectedProfileName:
          String(me.pushName || '') || config.connectedProfileName,
        lastHealthCheckAt: new Date(),
        lastConnectedAt:
          connectionStatus === 'CONNECTED'
            ? new Date()
            : config.lastConnectedAt,
        lastError:
          connectionStatus === 'ERROR'
            ? String(payload.error || 'WAHA oturumu hata durumuna geçti.').slice(
                0,
                500
              )
            : null,
      },
    });
    return NextResponse.json({ accepted: true });
  }

  if (event === 'message.ack') {
    const providerMessageId = String(payload.id || '');
    const delivery = deliveryFromAck(payload.ackName || payload.ack);
    if (providerMessageId && delivery) {
      const deliveredAt = delivery === 'DELIVERED' ? new Date() : undefined;
      const failedAt = delivery === 'FAILED' ? new Date() : undefined;
      await Promise.all([
        prisma.conversationMessage.updateMany({
          where: { providerMessageId },
          data: {
            deliveryStatus: delivery,
            ...(deliveredAt ? { deliveredAt } : {}),
            ...(failedAt ? { failedAt } : {}),
          },
        }),
        prisma.whatsAppOutboxMessage.updateMany({
          where: { providerMessageId },
          data: {
            status: delivery,
            ...(deliveredAt ? { deliveredAt } : {}),
            ...(failedAt ? { failedAt } : {}),
          },
        }),
        prisma.whatsAppMessage.updateMany({
          where: { providerMessageId, companyAccountId: accountId },
          data: { status: delivery },
        }),
      ]);
    }
    return NextResponse.json({ accepted: true });
  }

  if (event !== 'message' || payload.fromMe === true) {
    return NextResponse.json({ accepted: true, ignored: true });
  }

  const details = messageDetails(payload);
  if (
    !details.from ||
    details.from.endsWith('@g.us') ||
    details.from === 'status@broadcast'
  ) {
    return NextResponse.json({ accepted: true, ignored: true });
  }

  const providerMessageId = String(payload.id || '');
  const text =
    String(payload.body || '').trim() ||
    (payload.hasMedia ? '[Medya mesajı alındı]' : '[Desteklenmeyen WhatsApp mesajı]');
  const input = {
    companyAccountId: accountId,
    provider: 'WAHA' as const,
    fromPhone: details.from,
    contactName:
      details.pushName ||
      `WhatsApp ${details.from.replace(/\D/g, '').slice(-4)}`,
    text,
    providerMessageId,
    messageType: payload.hasMedia ? 'media' : 'text',
  };

  after(async () => {
    await processIncomingWhatsAppMessage(input).catch(async (error) => {
      console.error('[WAHA Webhook Worker Error]:', error);
      await prisma.whatsAppConfig.update({
        where: { companyAccountId: accountId },
        data: {
          lastError:
            error instanceof Error
              ? error.message.slice(0, 500)
              : 'Gelen mesaj işlenemedi.',
        },
      });
    });
  });

  return NextResponse.json({ accepted: true });
}
