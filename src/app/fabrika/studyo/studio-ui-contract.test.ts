import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const studioPageSource = readFileSync(
  new URL('./page.tsx', import.meta.url),
  'utf8'
);
const posterMakerSource = readFileSync(
  new URL('../../../components/fabrika/PosterMaker.tsx', import.meta.url),
  'utf8'
);

describe('studio UI contract', () => {
  it('keeps the executive studio layout and poster workspace', () => {
    expect(studioPageSource).toContain("import styles from './studio.module.css';");
    expect(studioPageSource).toContain('className={styles.page}');
    expect(studioPageSource).toContain('className={styles.posterWorkspace}');
    expect(studioPageSource).toContain('className={styles.comparePanel}');
    expect(studioPageSource).toContain('className={styles.recentWorks}');
  });

  it('keeps portfolio media controls in the poster maker', () => {
    expect(posterMakerSource).toContain("from '@/lib/property-media-selection';");
    expect(posterMakerSource).toContain('selectedPosterSources');
    expect(posterMakerSource).toContain('savePosterToProperty');
    expect(posterMakerSource).toContain("'mediaIdsJson'");
  });
});
