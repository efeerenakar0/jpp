import { describe, expect, it } from 'vitest';
import {
  createExecutivePortfolioDraft,
  deserializeExecutivePortfolioDraft,
  executivePortfolioReducer,
  EXECUTIVE_WORKFLOW_STEPS,
  resolveExecutiveWorkflowEntryStep,
  serializeExecutivePortfolioDraft,
} from './executive-portfolio-workflow';

describe('executive portfolio workflow', () => {
  it('merges Studio and AI Portfolio Specialist entries into the same portfolio step', () => {
    const studioDraft = executivePortfolioReducer(
      createExecutivePortfolioDraft(),
      { type: 'choose-source', source: 'studio' }
    );
    const hunterDraft = executivePortfolioReducer(
      createExecutivePortfolioDraft(),
      { type: 'choose-source', source: 'hunter' }
    );

    expect(studioDraft.currentStep).toBe('portfolio');
    expect(hunterDraft.currentStep).toBe('portfolio');
    expect(studioDraft.source).toBe('studio');
    expect(hunterDraft.source).toBe('hunter');
  });

  it('keeps the agreed six-step order and stops at both boundaries', () => {
    expect(EXECUTIVE_WORKFLOW_STEPS).toEqual([
      'source',
      'portfolio',
      'review',
      'advertising',
      'marketing',
      'results',
    ]);

    const initial = createExecutivePortfolioDraft();
    const beforeStart = executivePortfolioReducer(initial, { type: 'back' });
    expect(beforeStart.currentStep).toBe('source');

    const results = executivePortfolioReducer(initial, {
      type: 'go-to-step',
      step: 'results',
    });
    const afterResults = executivePortfolioReducer(results, { type: 'next' });
    expect(afterResults.currentStep).toBe('results');
  });

  it('does not let dashboard shortcuts bypass portfolio creation', () => {
    const initial = createExecutivePortfolioDraft();
    expect(resolveExecutiveWorkflowEntryStep(initial, 'marketing')).toBe('source');

    const sourced = executivePortfolioReducer(initial, {
      type: 'choose-source',
      source: 'studio',
    });
    expect(resolveExecutiveWorkflowEntryStep(sourced, 'advertising')).toBe(
      'portfolio'
    );

    const persisted = executivePortfolioReducer(sourced, {
      type: 'set-property-id',
      propertyId: 'property-1',
    });
    expect(resolveExecutiveWorkflowEntryStep(persisted, 'marketing')).toBe(
      'marketing'
    );
  });

  it('tracks every image independently and supports retry, cover, remove and original restore', () => {
    let draft = executivePortfolioReducer(createExecutivePortfolioDraft(), {
      type: 'add-media',
      media: [
        { id: 'front', name: 'cephe.jpg', size: 1200 },
        { id: 'salon', name: 'salon.jpg', size: 1800 },
      ],
    });

    draft = executivePortfolioReducer(draft, {
      type: 'update-media',
      id: 'front',
      progress: 58,
      status: 'processing',
    });
    draft = executivePortfolioReducer(draft, {
      type: 'update-media',
      id: 'salon',
      progress: 34,
      status: 'error',
      error: 'Yükleme kesildi',
    });

    expect(draft.media[0]).toMatchObject({ progress: 58, status: 'processing' });
    expect(draft.media[1]).toMatchObject({ progress: 34, status: 'error' });

    draft = executivePortfolioReducer(draft, { type: 'retry-media', id: 'salon' });
    expect(draft.media[1]).toMatchObject({ progress: 0, status: 'queued' });

    draft = executivePortfolioReducer(draft, { type: 'select-cover', id: 'front' });
    expect(draft.coverMediaId).toBe('front');

    draft = executivePortfolioReducer(draft, { type: 'remove-media', id: 'front' });
    expect(draft.media[0].removed).toBe(true);
    expect(draft.coverMediaId).toBeNull();

    draft = executivePortfolioReducer(draft, { type: 'restore-original', id: 'front' });
    expect(draft.media[0]).toMatchObject({ removed: false, restoredToOriginal: true });
  });

  it('stores portfolio details, optional advertising choice and marketing targets', () => {
    let draft = executivePortfolioReducer(createExecutivePortfolioDraft(), {
      type: 'update-details',
      details: {
        title: 'Kestel Villa',
        location: 'Alanya / Kestel',
        description: 'Denize yakın müstakil villa',
      },
    });
    draft = executivePortfolioReducer(draft, {
      type: 'set-advertising-skipped',
      skipped: true,
    });
    draft = executivePortfolioReducer(draft, {
      type: 'set-marketing',
      countries: ['Türkiye', 'Almanya'],
      channels: ['Instagram', 'WhatsApp'],
      copy: 'Denize yakın villayı bugün keşfedin.',
    });

    expect(draft.details.title).toBe('Kestel Villa');
    expect(draft.advertising.skipped).toBe(true);
    expect(draft.marketing).toEqual({
      countries: ['Türkiye', 'Almanya'],
      channels: ['Instagram', 'WhatsApp'],
      copy: 'Denize yakın villayı bugün keşfedin.',
    });
  });

  it('skips optional advertising and advances directly to marketing', () => {
    const advertisingDraft = executivePortfolioReducer(
      createExecutivePortfolioDraft(),
      { type: 'go-to-step', step: 'advertising' }
    );

    const marketingDraft = executivePortfolioReducer(advertisingDraft, {
      type: 'skip-advertising',
    });

    expect(marketingDraft.advertising.skipped).toBe(true);
    expect(marketingDraft.currentStep).toBe('marketing');
  });

  it('round-trips a versioned autosave and rejects corrupted storage', () => {
    let draft = executivePortfolioReducer(createExecutivePortfolioDraft(), {
      type: 'choose-source',
      source: 'studio',
    });
    draft = executivePortfolioReducer(draft, {
      type: 'add-media',
      media: [
        {
          id: 'local-preview',
          name: 'salon.jpg',
          size: 500,
          previewUrl: 'blob:http://localhost/temporary',
        },
      ],
    });
    const serialized = serializeExecutivePortfolioDraft(draft);
    const restored = deserializeExecutivePortfolioDraft(serialized);

    expect(restored).toMatchObject({
      id: draft.id,
      source: 'studio',
      currentStep: 'portfolio',
    });
    expect(restored?.media[0]).toMatchObject({ id: 'local-preview', name: 'salon.jpg' });
    expect(restored?.media[0]).not.toHaveProperty('previewUrl');
    expect(serialized).not.toContain('blob:http://localhost/temporary');
    expect(deserializeExecutivePortfolioDraft('{not-json')).toBeNull();
    expect(
      deserializeExecutivePortfolioDraft(JSON.stringify({ version: 99, draft }))
    ).toBeNull();
  });

  it('stores the real background Studio batch and replaces temporary uploads', () => {
    let draft = executivePortfolioReducer(createExecutivePortfolioDraft(), {
      type: 'add-media',
      media: [{ id: 'temporary', name: 'salon.jpg', size: 500 }],
    });
    draft = executivePortfolioReducer(draft, {
      type: 'sync-studio-batch',
      batchId: 'batch-1',
      media: [
        {
          id: 'item-1',
          name: 'salon.jpg',
          size: 500,
          progress: 65,
          status: 'processing',
          removed: false,
          restoredToOriginal: false,
          originalUrl: '/original.jpg',
        },
      ],
    });

    expect(draft.studioBatchId).toBe('batch-1');
    expect(draft.media).toHaveLength(1);
    expect(draft.media[0]).toMatchObject({
      id: 'item-1',
      status: 'processing',
      originalUrl: '/original.jpg',
    });
  });

  it('stores the real portfolio record created by the popup flow', () => {
    const draft = executivePortfolioReducer(createExecutivePortfolioDraft(), {
      type: 'set-property-id',
      propertyId: 'property-1',
    });

    expect(draft.propertyId).toBe('property-1');
  });
});
