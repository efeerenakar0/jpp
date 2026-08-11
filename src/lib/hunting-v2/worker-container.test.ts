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
    expect(dockerfile).toContain('NODE_OPTIONS=--conditions=react-server');
    expect(dockerfile).toContain('PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=true');
    expect(dockerfile).toContain('PUPPETEER_SKIP_DOWNLOAD=true');
    expect(dockerfile).toContain(
      'FROM apify/actor-node-playwright-chrome:24-1.62.1'
    );
    expect(dockerfile).toContain('USER myuser');
    expect(dockerfile).toContain('ENTRYPOINT ["tini", "-s", "--"]');
  });

  it('Crawlee süreç ağacının ihtiyaç duyduğu ps komutunu imaja ekler', () => {
    const dockerfile = readFileSync(
      join(process.cwd(), 'Dockerfile.avci-worker'),
      'utf8'
    );

    expect(dockerfile).toMatch(
      /apt-get install[^\n]*ca-certificates[^\n]*openssl[^\n]*procps[^\n]*tini/
    );
  });

  it('Apify Actor tanımı aynı güvenli worker konteynerini tek seferlik çalıştırır', () => {
    const dockerfile = readFileSync(
      join(process.cwd(), 'Dockerfile.avci-worker'),
      'utf8'
    );
    const actorDefinition = JSON.parse(
      readFileSync(join(process.cwd(), '.actor/actor.json'), 'utf8')
    );

    expect(actorDefinition).toMatchObject({
      actorSpecification: 1,
      name: 'business-ai-portfoy-uzmani-worker',
      dockerfile: '../Dockerfile.avci-worker',
      dockerContextDir: '..',
      defaultMemoryMbytes: 2048,
      minMemoryMbytes: 2048,
      usesStandbyMode: false,
      environmentVariables: {
        AVCI_RUN_ONCE: 'true',
        AVCI_LIVE_PROVIDER_ENABLED: 'true',
        AVCI_WORKER_API_URL:
          'https://jpp-ufeb.vercel.app/api/internal/hunting-worker',
        AVCI_APIFY_PROXY_ENABLED: 'true',
        AVCI_APIFY_PROXY_REQUIRED: 'true',
        AVCI_APIFY_PROXY_GROUPS: 'RESIDENTIAL',
        AVCI_APIFY_PROXY_COUNTRY_CODE: 'TR',
        AVCI_CRAWLER_DELAY_SECS: '13',
        AVCI_CRAWLER_MAX_REQUESTS_PER_MINUTE: '5',
        AVCI_CRAWLER_MAX_LISTINGS_PER_JOB: '11',
        CRAWLEE_XVFB: '1',
      },
    });
    expect(actorDefinition.maxMemoryMbytes).toBe(2048);
    expect(dockerfile).toContain(
      'CMD ["xvfb-run", "-a", "npm", "run", "worker:avci"]'
    );
  });

  it('Actor veri duzlemi veritabani ve telefon sirlarini dogrudan import etmez', () => {
    const worker = readFileSync(
      join(process.cwd(), 'src/lib/hunting-v2/worker.ts'),
      'utf8'
    );

    expect(worker).not.toContain("from '@/lib/prisma'");
    expect(worker).not.toContain("from './contact-crypto'");
    expect(worker).not.toContain("from './authorized-source-contact'");
    expect(worker).not.toContain("from './media'");
  });
});
