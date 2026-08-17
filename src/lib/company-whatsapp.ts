import 'server-only';

import { randomUUID } from 'node:crypto';
import type { MessageDeliveryStatus, Prisma } from '@prisma/client';
import prisma from '@/lib/prisma';
import { getCompanyOperationalStatus } from '@/lib/digital-manager/company-guard';
import {
  appendMessageDeliveryAudit,
  applyMessageDeliveryTransition,
  reconcileProviderDeliveryReceipts,
} from '@/lib/digital-manager/message-delivery';
import {
  clientDeliveryStatus,
  type DeliveryRuntimeStatus,
} from '@/lib/digital-manager/message-delivery-policy';
import {
  checkEvolutionHealth,
  configureEvolutionWebhook,
  connectEvolutionInstance,
  createEvolutionInstance,
  getEvolutionConnectionState,
  logoutEvolutionInstance,
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
  restartWahaSession,
  sendWahaText,
  startWahaSession,
  updateWahaSession,
  type WahaSession,
  type WahaSessionStatus,
  type WahaWebhook,
} from '@/lib/waha-client';
import {
  classifyStaleWhatsAppDispatch,
  classifyWhatsAppDispatchFailure,
} from '@/lib/whatsapp-outbox-policy';
import { wahaRecoveryAction } from '@/lib/whatsapp-connection-policy';
import { requireContactPolicyApproval } from '@/lib/hunting-v2/contact-service';

export type WhatsAppProvider = 'WAHA' | 'EVOLUTION' | 'META';

type CompanyWhatsAppDb = Prisma.TransactionClient | typeof prisma;

export function normalizeWhatsAppProvider(
  value: string | null | undefined
): WhatsAppProvider {
  // All company accounts now use the QR-based WAHA gateway. Legacy provider
  // values are migrated lazily when their owner opens WhatsApp Merkezi.
  void value;
  return 'WAHA';
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

export async function ensureCompanyWhatsAppConfig(
  companyAccountId: string,
  db: CompanyWhatsAppDb = prisma
) {
  const account = await db.companyAccount.findUnique({
    where: { id: companyAccountId },
    select: { id: true, slug: true, companyName: true },
  });
  if (!account) {
    throw new Error('Şirket hesabı bulunamadı.');
  }

  return db.whatsAppConfig.upsert({
    where: { companyAccountId },
    update: { provider: 'WAHA' },
    create: {
      companyAccountId,
      provider: 'WAHA',
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
  platformEnabled: boolean;
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
    configured: Boolean(config.evolutionInstanceName),
    connectionStatus: config.connectionStatus,
    connectedPhone: config.connectedPhone
      ? `••••${config.connectedPhone.slice(-4)}`
      : null,
    connectedProfileName: config.connectedProfileName,
    lastConnectedAt: config.lastConnectedAt,
    lastHealthCheckAt: config.lastHealthCheckAt,
    lastError: config.lastError,
    platformEnabled: config.platformEnabled,
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

async function recoverWahaSession(
  sessionName: string,
  session: WahaSession
) {
  const recoveryAction = wahaRecoveryAction(session.status);
  if (recoveryAction === 'restart') {
    return restartWahaSession(sessionName);
  }
  if (recoveryAction === 'start') {
    return startWahaSession(sessionName);
  }
  return session;
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

  session = await recoverWahaSession(sessionName, session);
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
    let session = await getWahaSession(config.evolutionInstanceName);
    if (!session) {
      return prepareWahaConnection(companyAccountId);
    }
    session = await recoverWahaSession(
      config.evolutionInstanceName,
      session
    );
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
  if (!isWahaConfigured()) {
    throw new Error('WhatsApp QR gateway henüz yapılandırılmamış.');
  }
  return prepareWahaConnection(companyAccountId);
}

export async function refreshCompanyWhatsAppConnection(
  companyAccountId: string
) {
  return refreshWahaConnection(companyAccountId);
}

export async function disconnectCompanyWhatsAppConnection(
  companyAccountId: string
) {
  return disconnectWahaConnection(companyAccountId);
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
  let current = await prisma.whatsAppOutboxMessage.findUnique({
    where: { id },
  });
  if (
    !current ||
    ['SENT', 'DELIVERED', 'READ', 'FAILED'].includes(current.status)
  ) {
    return current;
  }

  const now = new Date();
  const staleDisposition = classifyStaleWhatsAppDispatch(current, now);
  if (staleDisposition === 'AMBIGUOUS_TERMINAL') {
    await applyMessageDeliveryTransition({
      companyAccountId: current.companyAccountId,
      outboxMessageId: current.id,
      providerMessageId: current.providerMessageId || undefined,
      status: 'FAILED',
      rawStatus: 'DISPATCH_OUTCOME_UNKNOWN',
      errorCode: 'WHATSAPP_DISPATCH_OUTCOME_UNKNOWN',
      errorMessage:
        'Sağlayıcı gönderiminin sonucu kesinleştirilemedi. Çift mesajı önlemek için otomatik tekrar gönderim durduruldu.',
      idempotencyKey: `outbox:${current.id}:dispatch-outcome-unknown`,
      metadata: {
        attemptCount: current.attemptCount,
        automaticRetryPrevented: true,
      },
    });
    return prisma.whatsAppOutboxMessage.findUnique({ where: { id } });
  }
  if (staleDisposition === 'REQUEUE_SAFE') {
    await prisma.whatsAppOutboxMessage.updateMany({
      where: {
        id: current.id,
        companyAccountId: current.companyAccountId,
        status: 'PROCESSING',
        lockedAt: current.lockedAt,
      },
      data: {
        status: 'QUEUED',
        lockedAt: null,
        nextAttemptAt: now,
        lastError:
          'Gönderim öncesi yarım kalan güvenli işlem yeniden kuyruğa alındı.',
      },
    });
    current = await prisma.whatsAppOutboxMessage.findUnique({ where: { id } });
  }
  if (
    !current ||
    current.status !== 'QUEUED' ||
    current.lockedAt ||
    current.nextAttemptAt > now
  ) {
    return current;
  }
  const operational = await getCompanyOperationalStatus(
    current.companyAccountId
  );
  if (!operational.allowed) {
    await prisma.whatsAppOutboxMessage.updateMany({
      where: {
        id: current.id,
        companyAccountId: current.companyAccountId,
        status: 'QUEUED',
      },
      data: {
        nextAttemptAt: new Date(Date.now() + 60 * 60_000),
        lastError: `Şirket işlemlere kapalı: ${operational.reason}.`,
      },
    });
    return prisma.whatsAppOutboxMessage.findUnique({ where: { id } });
  }

  if (
    current.huntedContactId ||
    current.purpose === 'SALES_AUTHORITY_DISCUSSION' ||
    current.recipientType === 'PROPERTY_OWNER'
  ) {
    try {
      if (
        !current.listingId ||
        !current.huntedContactId ||
        current.purpose !== 'SALES_AUTHORITY_DISCUSSION'
      ) {
        throw new Error('Avcı iletişim bağlamı eksik.');
      }
      const policy = await requireContactPolicyApproval({
        companyAccountId: current.companyAccountId,
        listingId: current.listingId,
        contactId: current.huntedContactId,
        channel: 'WHATSAPP',
        purpose: current.purpose,
        evaluatedBy: 'SYSTEM:WHATSAPP_DISPATCH',
      });
      if (policy.phone !== current.toPhone) {
        throw new Error('Avcı iletişim alıcısı politika kaydıyla eşleşmiyor.');
      }
    } catch (error) {
      await applyMessageDeliveryTransition({
        companyAccountId: current.companyAccountId,
        outboxMessageId: current.id,
        status: 'FAILED',
        rawStatus: 'CONTACT_POLICY_DENIED',
        errorCode: 'CONTACT_POLICY_DENIED',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'İletişim politikası gönderimi reddetti.',
        idempotencyKey: `outbox:${current.id}:contact-policy-denied`,
        metadata: { automaticRetryPrevented: true },
      });
      return prisma.whatsAppOutboxMessage.findUnique({ where: { id } });
    }
  }

  const claimed = await prisma.whatsAppOutboxMessage.updateMany({
    where: {
      id,
      status: 'QUEUED',
      lockedAt: null,
      nextAttemptAt: { lte: now },
    },
    data: {
      status: 'PROCESSING',
      lockedAt: now,
      attemptCount: { increment: 1 },
    },
  });
  if (claimed.count === 0) {
    return prisma.whatsAppOutboxMessage.findUnique({ where: { id } });
  }
  const outbox = await prisma.whatsAppOutboxMessage.findUniqueOrThrow({
    where: { id },
  });
  const attemptCount = outbox.attemptCount;
  await appendMessageDeliveryAudit({
    companyAccountId: outbox.companyAccountId,
    outboxMessageId: outbox.id,
    status: 'SENDING',
    idempotencyKey: `outbox:${outbox.id}:attempt:${attemptCount}:sending`,
    metadata: { attemptCount },
  });

  let sent: { providerMessageId: string };
  let sendAttempted = false;
  try {
    const config = await ensureCompanyWhatsAppConfig(
      outbox.companyAccountId
    );
    await checkDailyLimit(
      outbox.companyAccountId,
      config.dailyMessageLimit
    );
    const operationalBeforeSend = await getCompanyOperationalStatus(
      outbox.companyAccountId
    );
    if (!operationalBeforeSend.allowed) {
      throw new Error(
        `Şirket işlemlere kapalı: ${operationalBeforeSend.reason}.`
      );
    }
    if (
      config.connectionStatus !== 'CONNECTED' ||
      !config.evolutionInstanceName
    ) {
      throw new Error('WhatsApp telefonu bağlı değil.');
    }

    const fenced = await prisma.whatsAppOutboxMessage.updateMany({
      where: {
        id: outbox.id,
        companyAccountId: outbox.companyAccountId,
        status: 'PROCESSING',
        lockedAt: outbox.lockedAt,
      },
      data: {
        status: 'SENDING',
        lockedAt: new Date(),
      },
    });
    if (fenced.count === 0) {
      throw new Error('WhatsApp gönderim kilidi kaybedildi.');
    }
    sendAttempted = true;
    sent = await sendWahaText({
      sessionName: config.evolutionInstanceName,
      to: outbox.toPhone,
      text: outbox.content,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Mesaj gönderilemedi.';
    if (
      !sendAttempted &&
      message.startsWith('Şirket işlemlere kapalı:')
    ) {
      await prisma.whatsAppOutboxMessage.updateMany({
        where: {
          id: outbox.id,
          companyAccountId: outbox.companyAccountId,
          status: 'PROCESSING',
        },
        data: {
          status: 'QUEUED',
          nextAttemptAt: new Date(Date.now() + 60 * 60_000),
          lockedAt: null,
          attemptCount: { decrement: 1 },
          lastError: message.slice(0, 500),
        },
      });
      return prisma.whatsAppOutboxMessage.findFirst({
        where: {
          id: outbox.id,
          companyAccountId: outbox.companyAccountId,
        },
      });
    }
    const disposition = classifyWhatsAppDispatchFailure({
      sendAttempted,
      attemptCount,
      maxAttempts: outbox.maxAttempts,
    });
    if (disposition !== 'RETRY') {
      const ambiguous = disposition === 'AMBIGUOUS_TERMINAL';
      await applyMessageDeliveryTransition({
        companyAccountId: outbox.companyAccountId,
        outboxMessageId: outbox.id,
        providerMessageId: outbox.providerMessageId || undefined,
        status: 'FAILED',
        rawStatus: ambiguous
          ? 'DISPATCH_OUTCOME_UNKNOWN'
          : 'SEND_ATTEMPTS_EXHAUSTED',
        errorCode: ambiguous
          ? 'WHATSAPP_DISPATCH_OUTCOME_UNKNOWN'
          : 'WHATSAPP_SEND_FAILED',
        errorMessage: ambiguous
          ? `Sağlayıcı çağrısı başladı ancak kesin sonuç alınamadı. Çift mesajı önlemek için otomatik tekrar gönderilmedi. ${message}`.slice(
              0,
              500
            )
          : message,
        idempotencyKey: `outbox:${outbox.id}:attempt:${attemptCount}:${
          ambiguous ? 'ambiguous-failure' : 'terminal-failure'
        }`,
        metadata: {
          attemptCount,
          terminal: true,
          automaticRetryPrevented: ambiguous,
        },
      });
    } else {
      await prisma.$transaction(async (tx) => {
        await tx.whatsAppOutboxMessage.updateMany({
          where: {
            id: outbox.id,
            companyAccountId: outbox.companyAccountId,
            status: 'PROCESSING',
          },
          data: {
            status: 'QUEUED',
            nextAttemptAt: retryAt(attemptCount),
            lockedAt: null,
            lastError: message.slice(0, 500),
          },
        });
        await tx.messageDeliveryAudit.createMany({
          data: [
            {
              companyAccountId: outbox.companyAccountId,
              outboxMessageId: outbox.id,
              status: 'FAILED',
              providerMessageId: outbox.providerMessageId,
              rawStatus: 'RETRY_SCHEDULED',
              errorCode: 'WHATSAPP_SEND_RETRY',
              errorMessage: message.slice(0, 500),
              metadata: {
                attemptCount,
                terminal: false,
              },
              idempotencyKey: `outbox:${outbox.id}:attempt:${attemptCount}:retry`,
            },
          ],
          skipDuplicates: true,
        });
      });
    }
    return prisma.whatsAppOutboxMessage.findFirst({
      where: {
        id: outbox.id,
        companyAccountId: outbox.companyAccountId,
      },
    });
  }

  await applyMessageDeliveryTransition({
    companyAccountId: outbox.companyAccountId,
    outboxMessageId: outbox.id,
    providerMessageId: sent.providerMessageId,
    status: 'SENT',
    rawStatus: 'WAHA_ACCEPTED',
    idempotencyKey: `outbox:${outbox.id}:sent:${sent.providerMessageId}`,
    metadata: { attemptCount },
  });
  await reconcileProviderDeliveryReceipts({
    companyAccountId: outbox.companyAccountId,
    provider: outbox.provider,
    providerMessageId: sent.providerMessageId,
  });
  return prisma.whatsAppOutboxMessage.findFirst({
    where: {
      id: outbox.id,
      companyAccountId: outbox.companyAccountId,
    },
  });
}

export type CompanyWhatsAppQueueInput = {
  companyAccountId: string;
  to: string;
  text: string;
  conversationId?: string;
  listingId?: string;
  contactId?: string;
  huntedContactId?: string;
  propertyId?: string;
  recipientType?:
    | 'OWNER'
    | 'EMPLOYEE'
    | 'CRM_CONTACT'
    | 'PROPERTY_OWNER'
    | 'UNKNOWN';
  recipientId?: string;
  purpose?: string;
  relatedTaskId?: string;
  operationEventId?: string;
  managerActionId?: string;
  correlationId?: string;
  replyToProviderMessageId?: string;
  metadata?: Prisma.InputJsonValue;
  idempotencyKey?: string;
  createdByType?: string;
  createdById?: string;
  firstContact?: boolean;
  /**
   * Internal-only transaction support. When supplied, dispatch must be
   * deferred so the caller can atomically create its local projections.
   */
  tx?: Prisma.TransactionClient;
  deferDispatch?: boolean;
};

/** @internal Keeps Prisma's default and idempotency validation in agreement. */
export function normalizeWhatsAppRecipientType(
  recipientType: CompanyWhatsAppQueueInput['recipientType']
) {
  return recipientType || ('UNKNOWN' as const);
}

export async function queueCompanyWhatsAppMessage(
  input: CompanyWhatsAppQueueInput
) {
  if (input.tx && !input.deferDispatch) {
    throw new Error(
      'Veritabanı transactionı içinde dış WhatsApp gönderimi yapılamaz.'
    );
  }
  const db: CompanyWhatsAppDb = input.tx || prisma;
  const operational = await getCompanyOperationalStatus(
    input.companyAccountId,
    db
  );
  if (!operational.allowed) {
    throw new Error(`Şirket işlemlere kapalı: ${operational.reason}.`);
  }
  const config = await ensureCompanyWhatsAppConfig(input.companyAccountId, db);
  const provider = 'WAHA' as const;
  if (!config.platformEnabled) {
    throw new Error('WhatsApp otomasyonu platform yöneticisi tarafından durduruldu.');
  }
  if (input.firstContact && !config.allowFirstContact) {
    throw new Error(
      'Yeni numaralara ilk temas gönderimi şirket ayarlarında kapalı.'
    );
  }
  let phone = input.to.replace(/\D/g, '');
  if (
    input.huntedContactId ||
    input.purpose === 'SALES_AUTHORITY_DISCUSSION' ||
    input.recipientType === 'PROPERTY_OWNER'
  ) {
    if (
      !input.listingId ||
      !input.huntedContactId ||
      input.purpose !== 'SALES_AUTHORITY_DISCUSSION'
    ) {
      throw new Error(
        'Avcı ilk teması için ilan, doğrulanmış kişi ve amaç zorunludur.'
      );
    }
    const policy = await requireContactPolicyApproval({
      companyAccountId: input.companyAccountId,
      listingId: input.listingId,
      contactId: input.huntedContactId,
      channel: 'WHATSAPP',
      purpose: input.purpose,
      evaluatedBy: `${input.createdByType || 'SYSTEM'}:${input.createdById || 'UNKNOWN'}`,
      tx: input.tx,
    });
    if (!policy.phone || policy.phone !== phone) {
      throw new Error('Alıcı, onaylanmış Avcı iletişim kaydıyla eşleşmiyor.');
    }
    phone = policy.phone;
  }
  if (phone.length < 10 || phone.length > 15) {
    throw new Error('Geçerli, ülke kodlu bir telefon numarası girin.');
  }
  const idempotencyKey = input.idempotencyKey || randomUUID();
  const recipientType = normalizeWhatsAppRecipientType(input.recipientType);
  const createOutbox = async (tx: Prisma.TransactionClient) => {
    const [
      conversation,
      listing,
      contact,
      huntedContact,
      property,
      task,
      operationEvent,
      managerAction,
    ] = await Promise.all([
      input.conversationId
        ? tx.customerConversation.findFirst({
            where: {
              id: input.conversationId,
              companyAccountId: input.companyAccountId,
            },
            select: { id: true },
          })
        : null,
      input.listingId
        ? tx.huntedListing.findFirst({
            where: {
              id: input.listingId,
              companyAccountId: input.companyAccountId,
            },
            select: { id: true },
          })
        : null,
      input.contactId
        ? tx.crmContact.findFirst({
            where: {
              id: input.contactId,
              companyAccountId: input.companyAccountId,
            },
            select: { id: true },
          })
        : null,
      input.huntedContactId
        ? tx.huntedContact.findFirst({
            where: {
              id: input.huntedContactId,
              companyAccountId: input.companyAccountId,
              listingId: input.listingId,
            },
            select: { id: true },
          })
        : null,
      input.propertyId
        ? tx.crmProperty.findFirst({
            where: {
              id: input.propertyId,
              companyAccountId: input.companyAccountId,
            },
            select: { id: true },
          })
        : null,
      input.relatedTaskId
        ? tx.crmTask.findFirst({
            where: {
              id: input.relatedTaskId,
              companyAccountId: input.companyAccountId,
            },
            select: { id: true },
          })
        : null,
      input.operationEventId
        ? tx.operationEvent.findFirst({
            where: {
              id: input.operationEventId,
              companyAccountId: input.companyAccountId,
            },
            select: { id: true },
          })
        : null,
      input.managerActionId
        ? tx.generalManagerAction.findFirst({
            where: {
              id: input.managerActionId,
              companyAccountId: input.companyAccountId,
            },
            select: { id: true },
          })
        : null,
    ]);
    const invalidReference =
      (input.conversationId && !conversation) ||
      (input.listingId && !listing) ||
      (input.contactId && !contact) ||
      (input.huntedContactId && !huntedContact) ||
      (input.propertyId && !property) ||
      (input.relatedTaskId && !task) ||
      (input.operationEventId && !operationEvent) ||
      (input.managerActionId && !managerAction);
    if (invalidReference) {
      throw new Error(
        'WhatsApp kuyruğu ilişkilerinden biri bu şirkete ait değil.'
      );
    }
    if (
      input.recipientType === 'OWNER' &&
      input.recipientId &&
      input.recipientId !== input.companyAccountId
    ) {
      throw new Error('WhatsApp patron alıcısı bu şirkete ait değil.');
    }
    if (input.recipientType === 'EMPLOYEE' && input.recipientId) {
      const member = await tx.companyMember.findFirst({
        where: {
          id: input.recipientId,
          companyAccountId: input.companyAccountId,
          active: true,
        },
        select: { id: true },
      });
      if (!member) {
        throw new Error('WhatsApp çalışan alıcısı bu şirkete ait değil.');
      }
    }
    const record = await tx.whatsAppOutboxMessage.upsert({
      where: {
        companyAccountId_idempotencyKey: {
          companyAccountId: input.companyAccountId,
          idempotencyKey,
        },
      },
      update: {},
      create: {
        companyAccountId: input.companyAccountId,
        conversationId: input.conversationId,
        listingId: input.listingId,
        contactId: input.contactId,
        huntedContactId: input.huntedContactId,
        propertyId: input.propertyId,
        recipientType,
        recipientId: input.recipientId,
        purpose: input.purpose,
        relatedTaskId: input.relatedTaskId,
        operationEventId: input.operationEventId,
        managerActionId: input.managerActionId,
        correlationId: input.correlationId,
        replyToProviderMessageId: input.replyToProviderMessageId,
        metadata: input.metadata,
        toPhone: phone,
        content: input.text,
        provider,
        idempotencyKey,
        createdByType: input.createdByType,
        createdById: input.createdById,
      },
    });
    if (
      record.toPhone !== phone ||
      record.content !== input.text ||
      (input.conversationId &&
        record.conversationId !== input.conversationId) ||
      record.listingId !== (input.listingId || null) ||
      record.contactId !== (input.contactId || null) ||
      record.huntedContactId !== (input.huntedContactId || null) ||
      record.propertyId !== (input.propertyId || null) ||
      record.recipientType !== recipientType ||
      record.recipientId !== (input.recipientId || null) ||
      record.purpose !== (input.purpose || null) ||
      record.relatedTaskId !== (input.relatedTaskId || null) ||
      record.operationEventId !== (input.operationEventId || null) ||
      record.managerActionId !== (input.managerActionId || null) ||
      record.correlationId !== (input.correlationId || null) ||
      record.replyToProviderMessageId !==
        (input.replyToProviderMessageId || null)
    ) {
      throw new Error(
        'Aynı idempotency anahtarı farklı bir WhatsApp mesajı için kullanılamaz.'
      );
    }
    await tx.messageDeliveryAudit.createMany({
      data: [
        {
          companyAccountId: input.companyAccountId,
          outboxMessageId: record.id,
          status: 'QUEUED',
          providerMessageId: record.providerMessageId,
          rawStatus: 'OUTBOX_CREATED',
          metadata: { provider },
          idempotencyKey: `outbox:${record.id}:queued`,
        },
      ],
      skipDuplicates: true,
    });
    return record;
  };
  const outbox = input.tx
    ? await createOutbox(input.tx)
    : await prisma.$transaction(createOutbox);
  const dispatched = input.deferDispatch
    ? outbox
    : await dispatchWhatsAppOutboxMessage(outbox.id);
  const deliveryStatus: MessageDeliveryStatus = clientDeliveryStatus(
    (dispatched?.status || 'QUEUED') as DeliveryRuntimeStatus
  );
  return {
    outboxId: outbox.id,
    providerMessageId:
      dispatched?.providerMessageId || `queue:${outbox.id}`,
    deliveryStatus,
    queued: deliveryStatus === 'QUEUED',
    lastError: dispatched?.lastError || null,
    toPhone: outbox.toPhone,
    conversationId: outbox.conversationId,
  };
}

export async function drainWhatsAppOutbox(limit = 25) {
  const now = new Date();
  const staleLock = new Date(now.getTime() - 5 * 60_000);
  const pending = await prisma.whatsAppOutboxMessage.findMany({
    where: {
      OR: [
        {
          status: 'QUEUED',
          nextAttemptAt: { lte: now },
          lockedAt: null,
        },
        {
          status: { in: ['PROCESSING', 'SENDING'] },
          lockedAt: { lt: staleLock },
        },
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
