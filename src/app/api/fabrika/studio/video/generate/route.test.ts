import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const mocks = vi.hoisted(() => ({
  principal: vi.fn(), catalog: vi.fn(), generate: vi.fn(), createJob: vi.fn(), serialize: vi.fn(),
}));

vi.mock('@/lib/fabrika-session', () => ({ requireFabrikaPrincipal: mocks.principal }));
vi.mock('@/lib/portfolio-video/data', () => ({ loadPortfolioVideoCatalog: mocks.catalog }));
vi.mock('@/lib/portfolio-video/openrouter-video-generator', () => ({ generatePortfolioRemotionProgram: mocks.generate }));
vi.mock('@/lib/studio-video/ai-browser-jobs', () => ({ createAiBrowserVideoJob: mocks.createJob, serializeAiBrowserJob: mocks.serialize }));

import { POST } from './route';

const portfolio = {
  id: 'p1', title: 'Kestel Daire', referenceCode: 'P1', location: 'Kestel', price: 5_000_000,
  roomCount: '2+1', area: 100, description: 'Ara: +90 543 572 07 69', features: ['Manzara'], status: 'ACTIVE',
  photos: [{ id: 'm1', url: 'https://blob.test/private.jpg', fileName: 'oda.jpg', isCover: true, width: 1000, height: 700 }],
  company: { name: 'Şirket', logoUrl: null, instagramUrl: null },
  advisor: { name: 'Efe', phone: '+905435720769', email: 'efe@example.com' },
};

function request(portfolioId = 'p1') {
  return new Request('https://app.test/api/fabrika/studio/video/generate', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ portfolioId, selectedPhotoIds: ['m1'], prompt: 'Lüks video yap', format: '9:16', durationSeconds: 15, creativeSeed: 44, idempotencyKey: 'generated-job-key' }),
  });
}

describe('POST /api/fabrika/studio/video/generate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.principal.mockResolvedValue({ account: { id: 'company-a' }, type: 'OWNER', member: null });
    mocks.catalog.mockResolvedValue({ portfolios: [portfolio] });
    mocks.generate.mockResolvedValue({ plan: {}, code: 'safe', codeHash: 'a'.repeat(64), model: 'primary', attempts: [] });
    mocks.createJob.mockResolvedValue({ id: 'j1' });
    mocks.serialize.mockReturnValue({ id: 'j1' });
  });

  it('rejects a portfolio absent from the authenticated tenant catalog', async () => {
    const response = await POST(request('other-tenant-property'));
    expect(response.status).toBe(404);
    expect(mocks.generate).not.toHaveBeenCalled();
    expect(mocks.createJob).not.toHaveBeenCalled();
  });

  it('removes PII and private asset URLs before calling OpenRouter', async () => {
    const incomingRequest = request();
    const response = await POST(incomingRequest);
    expect(response.status).toBe(201);
    const modelInput = mocks.generate.mock.calls[0][0];
    const serialized = JSON.stringify(modelInput);
    expect(serialized).not.toContain('905435720769');
    expect(serialized).not.toContain('efe@example.com');
    expect(serialized).not.toContain('blob.test');
    expect(modelInput.portfolio.assets[0].assetId).toBe('m1');
    expect(mocks.generate.mock.calls[0][1]).toEqual({
      signal: incomingRequest.signal,
    });
    expect(mocks.createJob).toHaveBeenCalledWith(expect.objectContaining({ actor: { companyAccountId: 'company-a', memberId: null }, portfolio: expect.objectContaining({ id: 'p1' }) }));
  });
});
