import { describe, expect, it, vi } from 'vitest';

const { redirectMock } = vi.hoisted(() => ({
  redirectMock: vi.fn(() => {
    throw new Error('NEXT_REDIRECT');
  }),
}));

vi.mock('next/navigation', () => ({ redirect: redirectMock }));

import LegacyExecutiveDashboardPage from './page';

describe('/fabrika/akilli-panel', () => {
  it('keeps the legacy URL working and resumes the dashboard workflow', async () => {
    await expect(LegacyExecutiveDashboardPage({})).rejects.toThrow(
      'NEXT_REDIRECT'
    );
    expect(redirectMock).toHaveBeenCalledWith(
      '/fabrika?workflow=portfolio&resume=1'
    );
  });

  it('preserves the whitelisted hunter launch intent', async () => {
    redirectMock.mockClear();
    await expect(
      LegacyExecutiveDashboardPage({
        searchParams: Promise.resolve({
          workflow: 'portfolio',
          entry: 'hunter',
          step: 'source',
        }),
      })
    ).rejects.toThrow('NEXT_REDIRECT');
    expect(redirectMock).toHaveBeenCalledWith(
      '/fabrika?workflow=portfolio&entry=hunter&step=source'
    );
  });
});
