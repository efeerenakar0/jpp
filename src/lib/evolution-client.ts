import 'server-only';

type EvolutionRequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
};

export type EvolutionConnectionState =
  | 'open'
  | 'connecting'
  | 'close'
  | 'unknown';

export type EvolutionConnectResult = {
  state: EvolutionConnectionState;
  qrCode: string | null;
  pairingCode: string | null;
  raw: unknown;
};

function apiUrl() {
  const value = process.env.EVOLUTION_API_URL?.trim().replace(/\/+$/, '');
  if (!value) {
    throw new Error('EVOLUTION_API_URL yapılandırılmamış.');
  }

  const parsed = new URL(value);
  const local =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';
  if (process.env.NODE_ENV === 'production' && parsed.protocol !== 'https:' && !local) {
    throw new Error('Evolution API üretimde HTTPS üzerinden çalışmalıdır.');
  }

  return value;
}

function apiKey() {
  const value = process.env.EVOLUTION_API_KEY?.trim();
  if (!value || value.length < 20) {
    throw new Error('EVOLUTION_API_KEY güvenli biçimde yapılandırılmamış.');
  }
  return value;
}

async function evolutionRequest<T>(
  path: string,
  options: EvolutionRequestOptions = {}
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    options.timeoutMs ?? 15_000
  );

  try {
    const response = await fetch(`${apiUrl()}${path}`, {
      method: options.method || 'GET',
      headers: {
        apikey: apiKey(),
        'Content-Type': 'application/json',
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: 'no-store',
    });
    const text = await response.text();
    let data: unknown = null;

    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = { message: text.slice(0, 300) };
      }
    }

    if (!response.ok) {
      const record = data as { message?: string; error?: string } | null;
      throw new Error(
        record?.message ||
          record?.error ||
          `Evolution API isteği başarısız (${response.status}).`
      );
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('Evolution API zaman aşımına uğradı.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeState(value: unknown): EvolutionConnectionState {
  const state = String(value || '').toLowerCase();
  if (state === 'open' || state === 'connected') return 'open';
  if (state === 'connecting') return 'connecting';
  if (state === 'close' || state === 'closed' || state === 'disconnected') {
    return 'close';
  }
  return 'unknown';
}

function findQrCode(payload: unknown): string | null {
  const value = payload as {
    base64?: string;
    qrcode?: { base64?: string; code?: string };
    qr?: string;
  } | null;
  return value?.base64 || value?.qrcode?.base64 || value?.qr || null;
}

export async function checkEvolutionHealth() {
  const startedAt = Date.now();
  const data = await evolutionRequest<unknown>('/');
  return { ok: true, latencyMs: Date.now() - startedAt, data };
}

export async function createEvolutionInstance(instanceName: string) {
  return evolutionRequest<{
    instance?: { instanceName?: string; instanceId?: string; status?: string };
    hash?: string;
    qrcode?: { base64?: string; code?: string };
  }>('/instance/create', {
    method: 'POST',
    body: {
      instanceName,
      integration: 'WHATSAPP-BAILEYS',
      qrcode: true,
      rejectCall: true,
      msgCall: 'Bu numara WhatsApp aramalarını kabul etmiyor.',
      alwaysOnline: false,
      readMessages: false,
      readStatus: false,
      syncFullHistory: false,
    },
  });
}

export async function configureEvolutionWebhook(
  instanceName: string,
  webhookUrl: string
) {
  return evolutionRequest<unknown>(
    `/webhook/set/${encodeURIComponent(instanceName)}`,
    {
      method: 'POST',
      body: {
        webhook: {
          enabled: true,
          url: webhookUrl,
          webhookByEvents: false,
          webhookBase64: false,
          events: [
            'APPLICATION_STARTUP',
            'QRCODE_UPDATED',
            'MESSAGES_UPSERT',
            'MESSAGES_UPDATE',
            'CONNECTION_UPDATE',
          ],
        },
      },
    }
  );
}

export async function connectEvolutionInstance(
  instanceName: string
): Promise<EvolutionConnectResult> {
  const raw = await evolutionRequest<Record<string, unknown>>(
    `/instance/connect/${encodeURIComponent(instanceName)}`
  );
  return {
    state: normalizeState(raw.instance || raw.state),
    qrCode: findQrCode(raw),
    pairingCode:
      typeof raw.pairingCode === 'string'
        ? raw.pairingCode
        : typeof raw.code === 'string'
          ? raw.code
          : null,
    raw,
  };
}

export async function getEvolutionConnectionState(instanceName: string) {
  const raw = await evolutionRequest<{
    instance?: { state?: string; instanceName?: string };
    state?: string;
  }>(`/instance/connectionState/${encodeURIComponent(instanceName)}`);
  return {
    state: normalizeState(raw.instance?.state || raw.state),
    raw,
  };
}

export async function sendEvolutionText(input: {
  instanceName: string;
  to: string;
  text: string;
}) {
  const raw = await evolutionRequest<{
    key?: { id?: string };
    messageId?: string;
    status?: string;
  }>(`/message/sendText/${encodeURIComponent(input.instanceName)}`, {
    method: 'POST',
    timeoutMs: 30_000,
    body: {
      number: input.to.replace(/\D/g, ''),
      text: input.text,
      delay: 800,
      linkPreview: false,
    },
  });
  const providerMessageId = raw.key?.id || raw.messageId;
  if (!providerMessageId) {
    throw new Error('Evolution API mesaj kimliği döndürmedi.');
  }
  return { providerMessageId, raw };
}

export async function logoutEvolutionInstance(instanceName: string) {
  return evolutionRequest<unknown>(
    `/instance/logout/${encodeURIComponent(instanceName)}`,
    { method: 'DELETE' }
  );
}
