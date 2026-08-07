import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createAiBrowserVideoJob } from './ai-browser-jobs';

const plan = {
  schemaVersion: 1 as const, creativeSeed: 7, format: '9:16' as const, durationSeconds: 15 as const,
  fps: 30 as const, width: 1080 as const, height: 1920 as const,
  theme: { background: '#020817', surface: '#0b1728', text: '#ffffff', accent: '#22d3ee', font: 'MODERN' as const },
  scenes: [
    { id: 'a', helper: 'Hero' as const, startFrame: 0, durationInFrames: 150, assetIds: ['m1'], factRefs: ['TITLE' as const], headline: 'A', body: null, motion: 'ZOOM_IN' as const, transition: 'FADE' as const, layout: 'FULL' as const },
    { id: 'b', helper: 'FeatureGrid' as const, startFrame: 150, durationInFrames: 150, assetIds: ['m1'], factRefs: ['FEATURE_1' as const], headline: 'B', body: null, motion: 'STILL' as const, transition: 'CUT' as const, layout: 'GRID' as const },
    { id: 'c', helper: 'LogoOutro' as const, startFrame: 300, durationInFrames: 150, assetIds: [], factRefs: ['COMPANY_NAME' as const], headline: 'C', body: null, motion: 'STILL' as const, transition: 'FADE' as const, layout: 'CENTER' as const },
  ],
};

const portfolio = {
  id: 'p1', title: 'Daire', referenceCode: null, location: 'Kestel', price: 5_000_000,
  roomCount: '2+1', area: 100, description: null, features: ['Manzara'], status: 'ACTIVE' as const,
  photos: [{ id: 'm1', url: 'https://blob.test/m1.jpg', fileName: 'm1.jpg', isCover: true }],
  company: { name: 'Şirket', logoUrl: null, instagramUrl: null },
  advisor: { name: 'Danışman', phone: null, email: null },
};

function input() {
  return {
    actor: { companyAccountId: 'company-a', memberId: 'member-a' }, portfolio, mediaIds: ['m1'],
    command: 'Lüks video', format: '9:16' as const, durationSeconds: 15 as const, plan,
    code: 'safe code', codeHash: 'a'.repeat(64), model: 'poolside/laguna-s-2.1:free',
    attempts: [{ model: 'poolside/laguna-s-2.1:free', error: null }], idempotencyKey: 'job-key-1',
  };
}

describe('AI browser video job ownership', () => {
  it('does not create a job when tenant-scoped property lookup fails', async () => {
    const client = { crmProperty: { findFirst: vi.fn().mockResolvedValue(null) }, studioVideoJob: { upsert: vi.fn() } };
    await expect(createAiBrowserVideoJob(input(), client as never)).rejects.toMatchObject({ code: 'PROPERTY_NOT_FOUND' });
    expect(client.crmProperty.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ companyAccountId: 'company-a' }) }));
    expect(client.studioVideoJob.upsert).not.toHaveBeenCalled();
  });

  it('stores model code and runtime facts only after media ownership validation', async () => {
    const client = {
      crmProperty: { findFirst: vi.fn().mockResolvedValue({ id: 'p1', media: [{ id: 'm1', url: 'https://blob.test/m1.jpg', fileName: 'm1.jpg', isCover: true }] }) },
      studioVideoJob: { upsert: vi.fn().mockImplementation(({ create }) => ({ id: 'j1', createdAt: new Date(), ...create })) },
    };
    await createAiBrowserVideoJob(input(), client as never);
    expect(client.studioVideoJob.upsert).toHaveBeenCalledWith(expect.objectContaining({ create: expect.objectContaining({ companyAccountId: 'company-a', propertyId: 'p1', provider: 'BROWSER_REMOTION_AI', durationSeconds: 15, ratio: '9:16' }) }));
  });
});
