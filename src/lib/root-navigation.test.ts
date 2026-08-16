import { describe, expect, it } from 'vitest';
import { resolveRootRedirect } from './root-navigation';

describe('root navigation', () => {
  it('keeps the public root available for the marketing website', () => {
    expect(resolveRootRedirect('/')).toBeNull();
  });

  it('does not intercept any other route', () => {
    expect(resolveRootRedirect('/blog')).toBeNull();
    expect(resolveRootRedirect('/fabrika')).toBeNull();
    expect(resolveRootRedirect('/fabrika-giris')).toBeNull();
  });
});
