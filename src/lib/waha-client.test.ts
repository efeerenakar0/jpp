import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  checkWahaHealth,
  createWahaSession,
  getWahaQrCode,
  restartWahaSession,
  sendWahaText,
} from './waha-client';

describe('WAHA API client', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.WAHA_API_URL;
  const originalKey = process.env.WAHA_API_KEY;

  beforeEach(() => {
    process.env.WAHA_API_URL = 'http://127.0.0.1:3000';
    process.env.WAHA_API_KEY =
      'test-api-key-with-more-than-twenty-characters';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.WAHA_API_URL;
    else process.env.WAHA_API_URL = originalUrl;
    if (originalKey === undefined) delete process.env.WAHA_API_KEY;
    else process.env.WAHA_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('creates an isolated session with only required webhook events', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          name: 'jasmine-acme',
          status: 'STARTING',
          config: {},
        }),
        { status: 201 }
      )
    );
    global.fetch = fetchMock;

    await createWahaSession({
      sessionName: 'jasmine-acme',
      webhook: {
        url: 'https://example.com/api/whatsapp/waha/webhook/account',
        events: ['message', 'message.ack', 'session.status'],
      },
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/sessions');
    expect(options.headers['X-Api-Key']).toBe(
      'test-api-key-with-more-than-twenty-characters'
    );
    expect(JSON.parse(options.body)).toMatchObject({
      name: 'jasmine-acme',
      start: true,
      config: {
        webhooks: [
          {
            events: ['message', 'message.ack', 'session.status'],
          },
        ],
      },
    });
  });

  it('normalizes the recipient and returns the provider message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: 'true_905321234567@c.us_PROVIDER1',
        }),
        { status: 201 }
      )
    );
    global.fetch = fetchMock;

    const result = await sendWahaText({
      sessionName: 'jasmine-acme',
      to: '+90 (532) 123 45 67',
      text: 'Merhaba',
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      session: 'jasmine-acme',
      chatId: '905321234567@c.us',
      text: 'Merhaba',
      linkPreview: false,
    });
    expect(result.providerMessageId).toBe(
      'true_905321234567@c.us_PROVIDER1'
    );
  });

  it('converts QR image bytes into a browser-safe data URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(Uint8Array.from([137, 80, 78, 71]), {
        status: 200,
        headers: { 'Content-Type': 'image/png' },
      })
    );
    global.fetch = fetchMock;

    await expect(getWahaQrCode('jasmine-acme')).resolves.toBe(
      'data:image/png;base64,iVBORw=='
    );
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/jasmine-acme/auth/qr');
    expect(options.method).toBe('GET');
  });

  it('restarts a failed session before requesting another QR code', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ name: 'jasmine-acme', status: 'STARTING' }),
        { status: 200 }
      )
    );
    global.fetch = fetchMock;

    await expect(restartWahaSession('jasmine-acme')).resolves.toMatchObject({
      name: 'jasmine-acme',
      status: 'STARTING',
    });

    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:3000/api/sessions/jasmine-acme/restart');
    expect(options.method).toBe('POST');
  });

  it('explains that a 404 health response means the gateway is unavailable', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response('Not Found', { status: 404 })
    );

    await expect(checkWahaHealth()).rejects.toMatchObject({
      message:
        'WhatsApp bağlantı sunucusuna ulaşılamıyor. WAHA gateway kapalı veya yayın adresi erişilemiyor.',
      status: 404,
      code: 'WAHA_GATEWAY_UNAVAILABLE',
    });
  });

  it('does not expose provider details for an authentication failure', async () => {
    global.fetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          message: 'Invalid api key: secret-provider-detail',
        }),
        { status: 401 }
      )
    );

    await expect(checkWahaHealth()).rejects.toMatchObject({
      message:
        'WhatsApp gateway kimlik doğrulaması başarısız. Sunucu anahtarı eşleşmiyor.',
      status: 401,
      code: 'WAHA_AUTHENTICATION_FAILED',
    });
  });
});
