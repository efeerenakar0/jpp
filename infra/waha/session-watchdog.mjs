const baseUrl = (process.env.WAHA_INTERNAL_URL || 'http://waha:3000').replace(
  /\/+$/,
  ''
);
const apiKey = process.env.WAHA_API_KEY || '';
const intervalMs = Math.max(
  5_000,
  Number(process.env.WAHA_WATCHDOG_INTERVAL_MS) || 15_000
);

if (!apiKey) {
  throw new Error('WAHA_API_KEY gerekli.');
}

const headers = {
  Accept: 'application/json',
  'Content-Type': 'application/json',
  'X-Api-Key': apiKey,
};

async function request(path, init = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { ...headers, ...init.headers },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) {
    throw new Error(`${path} isteği ${response.status} döndürdü.`);
  }
  const contentType = response.headers.get('content-type') || '';
  return contentType.includes('application/json')
    ? response.json()
    : response.text();
}

async function healSessions() {
  const payload = await request('/api/sessions?all=true');
  const sessions = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  for (const session of sessions) {
    const name = String(session?.name || '').trim();
    const status = String(session?.status || '').toUpperCase();
    if (!name || !['FAILED', 'STOPPED'].includes(status)) continue;

    const action = status === 'FAILED' ? 'restart' : 'start';
    await request(
      `/api/sessions/${encodeURIComponent(name)}/${action}`,
      { method: 'POST' }
    );
    console.log(
      `[watchdog] ${name} ${status} durumundan ${action} ile kurtarıldı.`
    );
  }
}

for (;;) {
  try {
    await healSessions();
  } catch (error) {
    console.error(
      `[watchdog] ${error instanceof Error ? error.message : String(error)}`
    );
  }
  await new Promise((resolve) => setTimeout(resolve, intervalMs));
}
