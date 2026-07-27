import { after, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { processIncomingWhatsAppMessage } from '@/lib/whatsapp-incoming';
import { verifyWebhookSecret } from '@/lib/whatsapp-crypto';

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
    body.instance &&
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
    const rawStatus = String(data.status || data.update || '').toUpperCase();
    if (providerMessageId && rawStatus) {
      const delivered = /DELIVER|READ/.test(rawStatus);
      const failed = /FAIL|ERROR/.test(rawStatus);
      await Promise.all([
        prisma.conversationMessage.updateMany({
          where: { providerMessageId },
          data: {
            ...(delivered
              ? { deliveryStatus: 'DELIVERED', deliveredAt: new Date() }
              : {}),
            ...(failed
              ? { deliveryStatus: 'FAILED', failedAt: new Date() }
              : {}),
          },
        }),
        prisma.whatsAppOutboxMessage.updateMany({
          where: { providerMessageId },
          data: {
            ...(delivered
              ? { status: 'DELIVERED', deliveredAt: new Date() }
              : {}),
            ...(failed ? { status: 'FAILED', failedAt: new Date() } : {}),
          },
        }),
        prisma.whatsAppMessage.updateMany({
          where: { providerMessageId, companyAccountId: accountId },
          data: {
            ...(delivered ? { status: 'DELIVERED' } : {}),
            ...(failed ? { status: 'FAILED' } : {}),
          },
        }),
      ]);
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
  };
  after(async () => {
    await processIncomingWhatsAppMessage(input).catch(async (error) => {
      console.error('[Evolution Webhook Worker Error]:', error);
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
