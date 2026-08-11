import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { shouldUseStudioSuperResolution } from './studio-super-resolution';

describe('studio super-resolution routing', () => {
  it('routes only low-resolution photos to the optional GPU worker', () => {
    expect(shouldUseStudioSuperResolution({ width: 1280, height: 720 })).toBe(true);
    expect(shouldUseStudioSuperResolution({ width: 2400, height: 1600 })).toBe(false);
    expect(shouldUseStudioSuperResolution({ width: 2600, height: 900 })).toBe(true);
  });
});
