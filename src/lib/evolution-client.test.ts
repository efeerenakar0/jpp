import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  createEvolutionInstance,
  sendEvolutionText,
} from './evolution-client';

describe('Evolution API client', () => {
  const originalFetch = global.fetch;
  const originalUrl = process.env.EVOLUTION_API_URL;
  const originalKey = process.env.EVOLUTION_API_KEY;

  beforeEach(() => {
    process.env.EVOLUTION_API_URL = 'http://127.0.0.1:8080';
    process.env.EVOLUTION_API_KEY =
      'test-api-key-with-more-than-twenty-characters';
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalUrl === undefined) delete process.env.EVOLUTION_API_URL;
    else process.env.EVOLUTION_API_URL = originalUrl;
    if (originalKey === undefined) delete process.env.EVOLUTION_API_KEY;
    else process.env.EVOLUTION_API_KEY = originalKey;
    vi.restoreAllMocks();
  });

  it('creates an isolated Baileys instance without logging credentials', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          instance: { instanceName: 'jasmine-acme', instanceId: 'instance-1' },
        }),
        { status: 201 }
      )
    );
    global.fetch = fetchMock;

    await createEvolutionInstance('jasmine-acme');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe('http://127.0.0.1:8080/instance/create');
    expect(options.headers.apikey).toBe(
      'test-api-key-with-more-than-twenty-characters'
    );
    expect(JSON.parse(options.body)).toMatchObject({
      instanceName: 'jasmine-acme',
      integration: 'WHATSAPP-BAILEYS',
      readMessages: false,
      syncFullHistory: false,
    });
  });

  it('normalizes the recipient and returns the provider message id', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ key: { id: 'provider-message-1' } }), {
        status: 201,
      })
    );
    global.fetch = fetchMock;

    const result = await sendEvolutionText({
      instanceName: 'jasmine-acme',
      to: '+90 (532) 123 45 67',
      text: 'Merhaba',
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      number: '905321234567',
      text: 'Merhaba',
    });
    expect(result.providerMessageId).toBe('provider-message-1');
  });
});
