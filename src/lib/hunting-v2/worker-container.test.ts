import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('Avcı worker konteyneri', () => {
  it('root olmayan worker için yazılabilir geçici Crawlee alanı kullanır', () => {
    const dockerfile = readFileSync(
      join(process.cwd(), 'Dockerfile.avci-worker'),
      'utf8'
    );

    expect(dockerfile).toContain('CRAWLEE_STORAGE_DIR=/tmp/crawlee-storage');
    expect(dockerfile).toContain('USER node');
  });

  it('Apify Actor tanımı aynı güvenli worker konteynerini tek seferlik çalıştırır', () => {
    const actorDefinition = JSON.parse(
      readFileSync(join(process.cwd(), '.actor/actor.json'), 'utf8')
    );

    expect(actorDefinition).toMatchObject({
      actorSpecification: 1,
      name: 'business-ai-portfoy-uzmani-worker',
      dockerfile: '../Dockerfile.avci-worker',
      dockerContextDir: '..',
      defaultMemoryMbytes: 512,
      minMemoryMbytes: 512,
      usesStandbyMode: false,
      environmentVariables: {
        AVCI_RUN_ONCE: 'true',
      },
    });
  });
});
