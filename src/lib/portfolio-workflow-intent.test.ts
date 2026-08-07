import { describe, expect, it } from 'vitest';

import {
  buildPortfolioWorkflowHref,
  parsePortfolioWorkflowSearchParams,
  parseStoredPortfolioWorkflowIntent,
  resolvePortfolioWorkflowLaunch,
} from './portfolio-workflow-intent';
import { createExecutivePortfolioDraft } from './executive-portfolio-workflow';

describe('portfolio workflow launch intent', () => {
  it('accepts only whitelisted portfolio workflow values', () => {
    expect(
      parsePortfolioWorkflowSearchParams({
        workflow: 'portfolio',
        entry: 'hunter',
        step: 'review',
        resume: '1',
      })
    ).toEqual({ source: 'hunter', step: 'review', resume: true });

    expect(
      parsePortfolioWorkflowSearchParams({
        workflow: 'portfolio',
        entry: 'javascript:alert(1)',
        step: 'unknown',
      })
    ).toEqual({ resume: false });
    expect(parsePortfolioWorkflowSearchParams({ workflow: 'other' })).toBeNull();
  });

  it('rejects invalid stored values without throwing', () => {
    expect(parseStoredPortfolioWorkflowIntent('{broken')).toBeNull();
    expect(
      parseStoredPortfolioWorkflowIntent(
        JSON.stringify({ source: 'hunter', step: 'source', resume: false })
      )
    ).toEqual({ source: 'hunter', step: 'source', resume: false });
  });

  it('builds a canonical same-origin dashboard URL', () => {
    expect(
      buildPortfolioWorkflowHref({
        source: 'studio',
        step: 'marketing',
        resume: true,
      })
    ).toBe(
      '/fabrika?workflow=portfolio&entry=studio&step=marketing&resume=1'
    );
  });

  it('starts an Avcı launch at the source step and resumes saved work on request', () => {
    const fresh = createExecutivePortfolioDraft();
    expect(
      resolvePortfolioWorkflowLaunch(fresh, {
        source: 'hunter',
        step: 'source',
      })
    ).toEqual({ source: 'hunter', step: 'source' });

    const saved = {
      ...fresh,
      source: 'studio' as const,
      propertyId: 'property-1',
      currentStep: 'marketing' as const,
    };
    expect(resolvePortfolioWorkflowLaunch(saved, { resume: true })).toEqual({
      source: 'studio',
      step: 'marketing',
    });
  });
});
