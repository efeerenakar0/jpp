import { describe, expect, it } from 'vitest';
import {
  FABRIKA_ENTRY_PATH,
  resolveRootRedirect,
} from './root-navigation';

describe('root navigation', () => {
  it('redirects the public root directly to Fabrika login', () => {
    expect(resolveRootRedirect('/')).toBe(FABRIKA_ENTRY_PATH);
    expect(FABRIKA_ENTRY_PATH).toBe('/fabrika-giris');
  });

  it('does not intercept any other route', () => {
    expect(resolveRootRedirect('/blog')).toBeNull();
    expect(resolveRootRedirect('/fabrika')).toBeNull();
    expect(resolveRootRedirect('/fabrika-giris')).toBeNull();
  });
});
