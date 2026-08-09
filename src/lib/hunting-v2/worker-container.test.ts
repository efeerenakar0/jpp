import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Railway worker konteyneri', () => {
  it('root olmayan worker için yazılabilir geçici Crawlee alanı kullanır', () => {
    const dockerfile = readFileSync(
      join(process.cwd(), 'Dockerfile.avci-worker'),
      'utf8'
    );

    expect(dockerfile).toContain('CRAWLEE_STORAGE_DIR=/tmp/crawlee-storage');
    expect(dockerfile).toContain('USER node');
  });
});
