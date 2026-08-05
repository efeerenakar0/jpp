import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  callAI: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/ai', () => ({ callAI: mocks.callAI }));

import { callCompanyMarketingAI } from './marketing-ai';

const messages = [{ role: 'user' as const, content: 'Sahne planı oluştur.' }];

describe('callCompanyMarketingAI', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('tenant anahtarı aramadan platform AI yönlendirmesini kullanır', async () => {
    mocks.callAI.mockResolvedValue({
      content: 'Platform yanıtı',
      provider: 'GROQ',
      model: 'llama-platform',
    });

    const result = await callCompanyMarketingAI('company-a', messages, {
      jsonMode: true,
    });

    expect(mocks.callAI).toHaveBeenCalledOnce();
    expect(mocks.callAI).toHaveBeenCalledWith(messages, 'marketing');
    expect(result).toEqual({
      content: 'Platform yanıtı',
      provider: 'GROQ',
      model: 'llama-platform',
    });
  });

  it('platform servisi kullanılamadığında dürüstçe kural motoruna düşer', async () => {
    mocks.callAI.mockRejectedValue(new Error('platform unavailable'));

    await expect(callCompanyMarketingAI('company-a', messages)).resolves.toEqual({
      content: '',
      provider: 'RULE_ENGINE',
      model: null,
    });
  });
});
