import 'server-only';

type WahaRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  timeoutMs?: number;
  responseType?: 'json' | 'data-url';
};

export type WahaSessionStatus =
  | 'STARTING'
  | 'SCAN_QR_CODE'
  | 'PASSKEY_REQUIRED'
  | 'PASSKEY_CONFIRMATION_REQUIRED'
  | 'WORKING'
  | 'STOPPED'
  | 'FAILED'
  | 'UNKNOWN';

export type WahaSession = {
  name: string;
  status: WahaSessionStatus;
  config?: Record<string, unknown>;
  me?: {
    id?: string;
    pushName?: string;
    lid?: string;
    jid?: string;
  } | null;
  engine?: unknown;
};

export type WahaWebhook = {
  url: string;
  events: string[];
  retries?: {
    policy: 'constant' | 'linear' | 'exponential';
    delaySeconds: number;
    attempts: number;
  };
};

function apiUrl() {
  const value = process.env.WAHA_API_URL?.trim().replace(/\/+$/, '');
  if (!value) {
    throw new Error('WAHA_API_URL yapılandırılmamış.');
  }

  const parsed = new URL(value);
  const local =
    parsed.hostname === 'localhost' ||
    parsed.hostname === '127.0.0.1' ||
    parsed.hostname === '::1';
  if (
    process.env.NODE_ENV === 'production' &&
    parsed.protocol !== 'https:' &&
    !local
  ) {
    throw new Error('WAHA API üretimde HTTPS üzerinden çalışmalıdır.');
  }

  return value;
}

function apiKey() {
  const value = process.env.WAHA_API_KEY?.trim();
  if (!value || value.length < 20) {
    throw new Error('WAHA_API_KEY güvenli biçimde yapılandırılmamış.');
  }
  return value;
}

function normalizeStatus(value: unknown): WahaSessionStatus {
  const status = String(value || '').trim().toUpperCase();
  switch (status) {
    case 'STARTING':
    case 'SCAN_QR_CODE':
    case 'PASSKEY_REQUIRED':
    case 'PASSKEY_CONFIRMATION_REQUIRED':
    case 'WORKING':
    case 'STOPPED':
    case 'FAILED':
      return status;
    default:
      return 'UNKNOWN';
  }
}

async function wahaRequest<T>(
  path: string,
  options: WahaRequestOptions = {}
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
        'X-Api-Key': apiKey(),
        Accept:
          options.responseType === 'data-url'
            ? 'image/png,image/*;q=0.9,*/*;q=0.8'
            : 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'Content-Type': 'application/json' }),
      },
      body:
        options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (options.responseType === 'data-url' && response.ok) {
      const contentType = response.headers.get('content-type') || 'image/png';
      const bytes = Buffer.from(await response.arrayBuffer());
      return `data:${contentType};base64,${bytes.toString('base64')}` as T;
    }

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
      const record = data as
        | { message?: string; error?: string; detail?: string }
        | null;
      const error = new Error(
        record?.message ||
          record?.error ||
          record?.detail ||
          `WAHA API isteği başarısız (${response.status}).`
      );
      Object.assign(error, { status: response.status });
      throw error;
    }

    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('WAHA API zaman aşımına uğradı.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeSession(raw: WahaSession): WahaSession {
  return {
    ...raw,
    name: String(raw.name || ''),
    status: normalizeStatus(raw.status),
  };
}

function isNotFound(error: unknown) {
  return (
    error instanceof Error &&
    'status' in error &&
    (error as Error & { status?: number }).status === 404
  );
}

export function isWahaConfigured() {
  return Boolean(
    process.env.WAHA_API_URL?.trim() && process.env.WAHA_API_KEY?.trim()
  );
}

export async function checkWahaHealth() {
  const startedAt = Date.now();
  const sessions = await wahaRequest<WahaSession[]>('/api/sessions?all=true');
  return {
    ok: true,
    latencyMs: Date.now() - startedAt,
    sessions: sessions.map(normalizeSession),
  };
}

export async function getWahaSession(
  sessionName: string
): Promise<WahaSession | null> {
  try {
    const session = await wahaRequest<WahaSession>(
      `/api/sessions/${encodeURIComponent(sessionName)}`
    );
    return normalizeSession(session);
  } catch (error) {
    if (isNotFound(error)) return null;
    throw error;
  }
}

export async function createWahaSession(input: {
  sessionName: string;
  webhook: WahaWebhook;
}) {
  const session = await wahaRequest<WahaSession>('/api/sessions', {
    method: 'POST',
    body: {
      name: input.sessionName,
      start: true,
      config: {
        webhooks: [input.webhook],
      },
    },
    timeoutMs: 30_000,
  });
  return normalizeSession(session);
}

export async function updateWahaSession(input: {
  session: WahaSession;
  webhook: WahaWebhook;
}) {
  const config = {
    ...(input.session.config || {}),
    webhooks: [input.webhook],
  };
  const session = await wahaRequest<WahaSession>(
    `/api/sessions/${encodeURIComponent(input.session.name)}`,
    {
      method: 'PUT',
      body: {
        name: input.session.name,
        config,
      },
      timeoutMs: 30_000,
    }
  );
  return normalizeSession(session);
}

export async function startWahaSession(sessionName: string) {
  const session = await wahaRequest<WahaSession>(
    `/api/sessions/${encodeURIComponent(sessionName)}/start`,
    {
      method: 'POST',
      body: {},
      timeoutMs: 30_000,
    }
  );
  return normalizeSession(session);
}

export async function restartWahaSession(sessionName: string) {
  const session = await wahaRequest<WahaSession>(
    `/api/sessions/${encodeURIComponent(sessionName)}/restart`,
    {
      method: 'POST',
      body: {},
      timeoutMs: 30_000,
    }
  );
  return normalizeSession(session);
}

export async function getWahaQrCode(sessionName: string) {
  try {
    return await wahaRequest<string>(
      `/api/${encodeURIComponent(sessionName)}/auth/qr`,
      {
        // WAHA 2026.x returns the QR image from GET. POST was accepted by
        // earlier examples but now responds 404 on the GOWS engine.
        method: 'GET',
        timeoutMs: 30_000,
        responseType: 'data-url',
      }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/not ready|working|already|conflict/i.test(message)) return null;
    throw error;
  }
}

export async function sendWahaText(input: {
  sessionName: string;
  to: string;
  text: string;
}) {
  const phone = input.to.replace(/\D/g, '');
  const raw = await wahaRequest<{
    id?: string;
    key?: { id?: string };
    messageId?: string;
  }>('/api/sendText', {
    method: 'POST',
    timeoutMs: 30_000,
    body: {
      session: input.sessionName,
      chatId: `${phone}@c.us`,
      text: input.text,
      linkPreview: false,
    },
  });
  const providerMessageId = raw.id || raw.key?.id || raw.messageId;
  if (!providerMessageId) {
    throw new Error('WAHA API mesaj kimliği döndürmedi.');
  }
  return { providerMessageId, raw };
}

export async function logoutWahaSession(sessionName: string) {
  return wahaRequest<unknown>(
    `/api/sessions/${encodeURIComponent(sessionName)}/logout`,
    {
    method: 'POST',
    timeoutMs: 30_000,
    }
  );
}
