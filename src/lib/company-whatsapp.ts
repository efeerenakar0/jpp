import 'server-only';

import { randomUUID } from 'node:crypto';
import type { MessageDeliveryStatus } from '@prisma/client';
import prisma from '@/lib/prisma';
import {
  checkEvolutionHealth,
  configureEvolutionWebhook,
  connectEvolutionInstance,
  createEvolutionInstance,
  getEvolutionConnectionState,
  logoutEvolutionInstance,
  sendEvolutionText,
} from '@/lib/evolution-client';
import {
  generateWebhookSecret,
  hashWebhookSecret,
  verifyWebhookSecret,
} from '@/lib/whatsapp-crypto';
import {
  checkWahaHealth,
  createWahaSession,
  getWahaQrCode,
  getWahaSession,
  isWahaConfigured,
  logoutWahaSession,
  sendWahaText,
  startWahaSession,
  updateWahaSession,
  type WahaSession,
  type WahaSessionStatus,
  type WahaWebhook,
} from '@/lib/waha-client';

export type WhatsAppProvider = 'WAHA' | 'EVOLUTION' | 'META';

export function normalizeWhatsAppProvider(
  value: string | null | undefined
): WhatsAppProvider {
  if (value === 'META' || value === 'WAHA') return value;
  return 'EVOLUTION';
}

function safeInstanceName(slug: string, accountId: string) {
  const base = `${slug}-${accountId.slice(-6)}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return `jasmine-${base}`.slice(0, 48);
}

function publicAppUrl() {
  const value =
    process.env.APP_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : '');
  if (!value) {
    throw new Error('APP_URL yapılandırılmamış.');
  }
  return value.replace(/\/+$/, '');
}

export async function ensureCompanyWhatsAppConfig(companyAccountId: string) {
  const account = await prisma.companyAccount.findUnique({
    where: { id: companyAccountId },
    select: { id: true, slug: true, companyName: true },
  });
  if (!account) {
    throw new Error('Şirket hesabı bulunamadı.');
  }

  return prisma.whatsAppConfig.upsert({
    where: { companyAccountId },
    update: {},
    create: {
      companyAccountId,
      provider: isWahaConfigured() ? 'WAHA' : 'EVOLUTION',
      companyName: account.companyName,
      evolutionInstanceName: safeInstanceName(account.slug, account.id),
      connectionStatus: 'DISCONNECTED',
    },
  });
}

export function serializeCompanyWhatsAppStatus(config: {
  provider: string;
  connectionStatus: string;
  connectedPhone: string | null;
  connectedProfileName: string | null;
  lastConnectedAt: Date | null;
  lastHealthCheckAt: Date | null;
  lastError: string | null;
  autoReplyEnabled: boolean;
  allowFirstContact: boolean;
  dailyMessageLimit: number;
  evolutionInstanceName: string | null;
  token: string | null;
  phoneNumberId: string | null;
}) {
  const provider = normalizeWhatsAppProvider(config.provider);
  return {
    provider,
    configured:
      provider === 'EVOLUTION' || provider === 'WAHA'
        ? Boolean(config.evolutionInstanceName)
        : Boolean(config.token && config.phoneNumberId),
    connectionStatus: config.connectionStatus,
    connectedPhone: config.connectedPhone
      ? `••••${config.connectedPhone.slice(-4)}`
      : null,
    connectedProfileName: config.connectedProfileName,
    lastConnectedAt: config.lastConnectedAt,
    lastHealthCheckAt: config.lastHealthCheckAt,
    lastError: config.lastError,
    autoReplyEnabled: config.autoReplyEnabled,
    allowFirstContact: config.allowFirstContact,
    dailyMessageLimit: config.dailyMessageLimit,
  };
}

function wahaConnectionStatus(status: WahaSessionStatus) {
  switch (status) {
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

function connectedPhone(session: WahaSession) {
  return String(session.me?.id || session.me?.jid || '')
    .replace(/@.+$/, '')
    .replace(/:\d+$/, '')
    .replace(/\D/g, '');
}

function createWahaWebhook(url: string): WahaWebhook {
  return {
    url,
    events: ['message', 'message.ack', 'session.status'],
    retries: {
      policy: 'exponential',
      delaySeconds: 2,
      attempts: 8,
    },
  };
}

function existingWahaWebhook(
  session: WahaSession,
  companyAccountId: string,
  webhookSecretHash: string | null
) {
  const webhooks = Array.isArray(session.config?.webhooks)
    ? session.config.webhooks
    : [];
  return webhooks.find((item) => {
    if (!item || typeof item !== 'object') return false;
    const url = String((item as { url?: unknown }).url || '');
    try {
      const parsed = new URL(url);
      const token = parsed.searchParams.get('token');
      return (
        parsed.pathname.endsWith(
          `/api/whatsapp/waha/webhook/${encodeURIComponent(companyAccountId)}`
        ) && verifyWebhookSecret(token, webhookSecretHash)
      );
    } catch {
      return false;
    }
  });
}

export async function prepareWahaConnection(companyAccountId: string) {
  const config = await ensureCompanyWhatsAppConfig(companyAccountId);
  const bootstrapSession =
    normalizeWhatsAppProvider(config.provider) === 'WAHA'
      ? ''
      : process.env.WAHA_BOOTSTRAP_SESSION?.trim() || '';
  const sessionName =
    bootstrapSession ||
    config.evolutionInstanceName ||
    safeInstanceName('company', companyAccountId);

  await checkWahaHealth();
  let session = await getWahaSession(sessionName);
  let webhookSecret: string | null = null;

  if (!session) {
    webhookSecret = generateWebhookSecret();
    const webhookUrl = `${publicAppUrl()}/api/whatsapp/waha/webhook/${encodeURIComponent(
      companyAccountId
    )}?token=${encodeURIComponent(webhookSecret)}`;
    session = await createWahaSession({
      sessionName,
      webhook: createWahaWebhook(webhookUrl),
    });
  } else if (
    !existingWahaWebhook(
      session,
      companyAccountId,
      config.evolutionWebhookSecretHash
    )
  ) {
    webhookSecret = generateWebhookSecret();
    const webhookUrl = `${publicAppUrl()}/api/whatsapp/waha/webhook/${encodeURIComponent(
      companyAccountId
    )}?token=${encodeURIComponent(webhookSecret)}`;
    session = await updateWahaSession({
      session,
      webhook: createWahaWebhook(webhookUrl),
    });
  }

  if (session.status === 'STOPPED' || session.status === 'FAILED') {
    session = await startWahaSession(sessionName);
  }
  if (session.status === 'STARTING') {
    await new Promise((resolve) => setTimeout(resolve, 1_000));
    session = (await getWahaSession(sessionName)) || session;
  }

  const connectionStatus = wahaConnectionStatus(session.status);
  const phone = connectedPhone(session);
  const updated = await prisma.whatsAppConfig.update({
    where: { companyAccountId },
    data: {
      provider: 'WAHA',
      evolutionInstanceName: sessionName,
      evolutionInstanceId: session.me?.jid || session.me?.lid || null,
      ...(webhookSecret
        ? { evolutionWebhookSecretHash: hashWebhookSecret(webhookSecret) }
        : {}),
      connectionStatus,
      connectedPhone: phone || config.connectedPhone,
      connectedProfileName:
        session.me?.pushName || config.connectedProfileName,
      lastHealthCheckAt: new Date(),
      lastError: null,
      ...(connectionStatus === 'CONNECTED'
        ? { lastConnectedAt: new Date() }
        : {}),
    },
  });
  const qrCode =
    connectionStatus === 'WAITING_QR'
      ? await getWahaQrCode(sessionName).catch(() => null)
      : null;

  return {
    ...serializeCompanyWhatsAppStatus(updated),
    qrCode,
    pairingCode: null,
  };
}

export async function refreshWahaConnection(companyAccountId: string) {
  const config = await ensureCompanyWhatsAppConfig(companyAccountId);
  if (!config.evolutionInstanceName) {
    return {
      ...serializeCompanyWhatsAppStatus(config),
      qrCode: null,
      pairingCode: null,
    };
  }

  try {
    const session = await getWahaSession(config.evolutionInstanceName);
    if (!session) {
      throw new Error('WAHA şirket oturumu bulunamadı.');
    }
    const connectionStatus = wahaConnectionStatus(session.status);
    const phone = connectedPhone(session);
    const updated = await prisma.whatsAppConfig.update({
      where: { companyAccountId },
      data: {
        provider: 'WAHA',
        connectionStatus,
        connectedPhone: phone || config.connectedPhone,
        connectedProfileName:
          session.me?.pushName || config.connectedProfileName,
        evolutionInstanceId:
          session.me?.jid || session.me?.lid || config.evolutionInstanceId,
        lastHealthCheckAt: new Date(),
        lastError: null,
        ...(connectionStatus === 'CONNECTED' && !config.lastConnectedAt
          ? { lastConnectedAt: new Date() }
          : {}),
      },
    });
    const qrCode =
      connectionStatus === 'WAITING_QR'
        ? await getWahaQrCode(config.evolutionInstanceName).catch(() => null)
        : null;
    return {
      ...serializeCompanyWhatsAppStatus(updated),
      qrCode,
      pairingCode: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'WAHA bağlantısı kontrol edilemedi.';
    const updated = await prisma.whatsAppConfig.update({
      where: { companyAccountId },
      data: {
        connectionStatus: 'ERROR',
        lastHealthCheckAt: new Date(),
        lastError: message.slice(0, 500),
      },
    });
    return {
      ...serializeCompanyWhatsAppStatus(updated),
      qrCode: null,
      pairingCode: null,
    };
  }
}

export async function disconnectWahaConnection(companyAccountId: string) {
  const config = await ensureCompanyWhatsAppConfig(companyAccountId);
  if (config.evolutionInstanceName) {
    await logoutWahaSession(config.evolutionInstanceName).catch(() => null);
  }
  return prisma.whatsAppConfig.update({
    where: { companyAccountId },
    data: {
      connectionStatus: 'DISCONNECTED',
      connectedPhone: null,
      connectedProfileName: null,
      lastError: null,
    },
  });
}

export async function prepareEvolutionConnection(companyAccountId: string) {
  const config = await ensureCompanyWhatsAppConfig(companyAccountId);
  const instanceName =
    config.evolutionInstanceName ||
    safeInstanceName('company', companyAccountId);
  const webhookSecret = generateWebhookSecret();
  const webhookUrl = `${publicAppUrl()}/api/whatsapp/evolution/webhook/${encodeURIComponent(
    companyAccountId
  )}?token=${encodeURIComponent(webhookSecret)}`;

  await checkEvolutionHealth();

  let instanceId = config.evolutionInstanceId;
  try {
    const created = await createEvolutionInstance(instanceName);
    instanceId = created.instance?.instanceId || instanceId;
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (!/already|exist|duplicate/i.test(message)) {
      try {
        await getEvolutionConnectionState(instanceName);
      } catch {
        throw error;
      }
    }
  }

  await configureEvolutionWebhook(instanceName, webhookUrl);
  const connection = await connectEvolutionInstance(instanceName);
  const connectionStatus =
    connection.state === 'open'
      ? 'CONNECTED'
      : connection.state === 'connecting'
        ? 'WAITING_QR'
        : 'WAITING_QR';

  await prisma.whatsAppConfig.update({
    where: { companyAccountId },
    data: {
      provider: 'EVOLUTION',
      evolutionInstanceName: instanceName,
      evolutionInstanceId: instanceId,
      evolutionWebhookSecretHash: hashWebhookSecret(webhookSecret),
      connectionStatus,
      lastHealthCheckAt: new Date(),
      lastError: null,
      ...(connection.state === 'open' ? { lastConnectedAt: new Date() } : {}),
    },
  });

  return {
    connectionStatus,
    qrCode: connection.qrCode,
    pairingCode: connection.pairingCode,
  };
}

export async function refreshEvolutionConnection(companyAccountId: string) {
  const config = await ensureCompanyWhatsAppConfig(companyAccountId);
  if (normalizeWhatsAppProvider(config.provider) === 'META') {
    return {
      ...serializeCompanyWhatsAppStatus(config),
      qrCode: null,
      pairingCode: null,
    };
  }
  if (!config.evolutionInstanceName) {
    return {
      ...serializeCompanyWhatsAppStatus(config),
      qrCode: null,
      pairingCode: null,
    };
  }

  try {
    const state = await getEvolutionConnectionState(
      config.evolutionInstanceName
    );
    const connectionStatus =
      state.state === 'open'
        ? 'CONNECTED'
        : state.state === 'connecting'
          ? 'CONNECTING'
          : 'DISCONNECTED';
    const updated = await prisma.whatsAppConfig.update({
      where: { companyAccountId },
      data: {
        connectionStatus,
        lastHealthCheckAt: new Date(),
        lastError: null,
        ...(state.state === 'open' && !config.lastConnectedAt
          ? { lastConnectedAt: new Date() }
          : {}),
      },
    });
    return {
      ...serializeCompanyWhatsAppStatus(updated),
      qrCode: null,
      pairingCode: null,
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Bağlantı kontrol edilemedi.';
    const updated = await prisma.whatsAppConfig.update({
      where: { companyAccountId },
      data: {
        connectionStatus: 'ERROR',
        lastHealthCheckAt: new Date(),
        lastError: message.slice(0, 500),
      },
    });
    return {
      ...serializeCompanyWhatsAppStatus(updated),
      qrCode: null,
      pairingCode: null,
    };
  }
}

export async function disconnectEvolutionConnection(
  companyAccountId: string
) {
  const config = await ensureCompanyWhatsAppConfig(companyAccountId);
  if (config.evolutionInstanceName) {
    await logoutEvolutionInstance(config.evolutionInstanceName).catch(() => null);
  }
  return prisma.whatsAppConfig.update({
    where: { companyAccountId },
    data: {
      connectionStatus: 'DISCONNECTED',
      connectedPhone: null,
      connectedProfileName: null,
      lastError: null,
    },
  });
}

export async function prepareCompanyWhatsAppConnection(
  companyAccountId: string
) {
  return isWahaConfigured()
    ? prepareWahaConnection(companyAccountId)
    : prepareEvolutionConnection(companyAccountId);
}

export async function refreshCompanyWhatsAppConnection(
  companyAccountId: string
) {
  const config = await ensureCompanyWhatsAppConfig(companyAccountId);
  const provider = normalizeWhatsAppProvider(config.provider);
  if (provider === 'WAHA') {
    return refreshWahaConnection(companyAccountId);
  }
  if (provider === 'META') {
    return {
      ...serializeCompanyWhatsAppStatus(config),
      qrCode: null,
      pairingCode: null,
    };
  }
  return refreshEvolutionConnection(companyAccountId);
}

export async function disconnectCompanyWhatsAppConnection(
  companyAccountId: string
) {
  const config = await ensureCompanyWhatsAppConfig(companyAccountId);
  return normalizeWhatsAppProvider(config.provider) === 'WAHA'
    ? disconnectWahaConnection(companyAccountId)
    : disconnectEvolutionConnection(companyAccountId);
}

function retryAt(attemptCount: number) {
  const minutes = Math.min(60, 2 ** Math.max(0, attemptCount));
  return new Date(Date.now() + minutes * 60_000);
}

async function checkDailyLimit(
  companyAccountId: string,
  dailyMessageLimit: number
) {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const today = new Date(`${day}T00:00:00+03:00`);
  const count = await prisma.whatsAppOutboxMessage.count({
    where: {
      companyAccountId,
      status: { in: ['SENT', 'DELIVERED'] },
      sentAt: { gte: today },
    },
  });
  if (count >= dailyMessageLimit) {
    throw new Error(
      `Günlük güvenli gönderim limiti (${dailyMessageLimit}) doldu.`
    );
  }
}

export async function dispatchWhatsAppOutboxMessage(id: string) {
  const current = await prisma.whatsAppOutboxMessage.findUnique({
    where: { id },
  });
  if (!current || ['SENT', 'DELIVERED'].includes(current.status)) {
    return current;
  }

  const staleLock = new Date(Date.now() - 5 * 60_000);
  const claimed = await prisma.whatsAppOutboxMessage.updateMany({
    where: {
      id,
      OR: [
        { status: 'QUEUED', lockedAt: null },
        { status: 'PROCESSING', lockedAt: { lt: staleLock } },
      ],
    },
    data: {
      status: 'PROCESSING',
      lockedAt: new Date(),
      attemptCount: { increment: 1 },
    },
  });
  if (claimed.count === 0) {
    return prisma.whatsAppOutboxMessage.findUnique({ where: { id } });
  }
  const outbox = await prisma.whatsAppOutboxMessage.findUniqueOrThrow({
    where: { id },
  });
  const config = await ensureCompanyWhatsAppConfig(outbox.companyAccountId);
  const attemptCount = outbox.attemptCount;

  try {
    await checkDailyLimit(
      outbox.companyAccountId,
      config.dailyMessageLimit
    );
    const provider = normalizeWhatsAppProvider(config.provider);
    if (provider !== 'EVOLUTION' && provider !== 'WAHA') {
      throw new Error('Bu kuyruk kaydı bağlı cihaz sağlayıcısına ait değil.');
    }
    if (
      config.connectionStatus !== 'CONNECTED' ||
      !config.evolutionInstanceName
    ) {
      throw new Error('WhatsApp telefonu bağlı değil.');
    }

    const sent =
      provider === 'WAHA'
        ? await sendWahaText({
            sessionName: config.evolutionInstanceName,
            to: outbox.toPhone,
            text: outbox.content,
          })
        : await sendEvolutionText({
            instanceName: config.evolutionInstanceName,
            to: outbox.toPhone,
            text: outbox.content,
          });
    const updated = await prisma.whatsAppOutboxMessage.update({
      where: { id },
      data: {
        status: 'SENT',
        providerMessageId: sent.providerMessageId,
        sentAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    });
    await prisma.conversationMessage.updateMany({
      where: { providerMessageId: `queue:${id}` },
      data: {
        providerMessageId: sent.providerMessageId,
        deliveryStatus: 'SENT',
      },
    });
    await prisma.whatsAppMessage.updateMany({
      where: {
        companyAccountId: outbox.companyAccountId,
        providerMessageId: `queue:${id}`,
      },
      data: {
        providerMessageId: sent.providerMessageId,
        status: 'SENT',
      },
    });
    return updated;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Mesaj gönderilemedi.';
    const terminal = attemptCount >= outbox.maxAttempts;
    return prisma.whatsAppOutboxMessage.update({
      where: { id },
      data: {
        status: terminal ? 'FAILED' : 'QUEUED',
        nextAttemptAt: retryAt(attemptCount),
        failedAt: terminal ? new Date() : null,
        lockedAt: null,
        lastError: message.slice(0, 500),
      },
    });
  }
}

export async function queueCompanyWhatsAppMessage(input: {
  companyAccountId: string;
  to: string;
  text: string;
  conversationId?: string;
  listingId?: string;
  idempotencyKey?: string;
  createdByType?: string;
  createdById?: string;
  firstContact?: boolean;
}) {
  const config = await ensureCompanyWhatsAppConfig(input.companyAccountId);
  const provider = normalizeWhatsAppProvider(config.provider);
  if (provider !== 'EVOLUTION' && provider !== 'WAHA') {
    throw new Error('Şirket bağlı cihaz WhatsApp sağlayıcısını kullanmıyor.');
  }
  if (input.firstContact && !config.allowFirstContact) {
    throw new Error(
      'Yeni numaralara ilk temas gönderimi şirket ayarlarında kapalı.'
    );
  }
  const phone = input.to.replace(/\D/g, '');
  if (phone.length < 10 || phone.length > 15) {
    throw new Error('Geçerli, ülke kodlu bir telefon numarası girin.');
  }
  const idempotencyKey = input.idempotencyKey || randomUUID();
  const outbox = await prisma.whatsAppOutboxMessage.upsert({
    where: { idempotencyKey },
    update: {},
    create: {
      companyAccountId: input.companyAccountId,
      conversationId: input.conversationId,
      listingId: input.listingId,
      toPhone: phone,
      content: input.text,
      provider,
      idempotencyKey,
      createdByType: input.createdByType,
      createdById: input.createdById,
    },
  });
  const dispatched = await dispatchWhatsAppOutboxMessage(outbox.id);
  const deliveryStatus: MessageDeliveryStatus =
    dispatched?.status === 'SENT' ? 'SENT' : 'QUEUED';
  return {
    outboxId: outbox.id,
    providerMessageId:
      dispatched?.providerMessageId || `queue:${outbox.id}`,
    deliveryStatus,
    queued: deliveryStatus === 'QUEUED',
    lastError: dispatched?.lastError || null,
  };
}

export async function drainWhatsAppOutbox(limit = 25) {
  const pending = await prisma.whatsAppOutboxMessage.findMany({
    where: {
      status: { in: ['QUEUED', 'PROCESSING'] },
      nextAttemptAt: { lte: new Date() },
      OR: [
        { lockedAt: null },
        { lockedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
      ],
    },
    orderBy: { nextAttemptAt: 'asc' },
    take: Math.max(1, Math.min(100, limit)),
    select: { id: true },
  });
  const results = [];
  for (const item of pending) {
    results.push(await dispatchWhatsAppOutboxMessage(item.id));
  }
  return results;
}
