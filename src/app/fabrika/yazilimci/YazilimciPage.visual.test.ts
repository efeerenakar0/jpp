import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const pageSource = readFileSync(new URL('./page.tsx', import.meta.url), 'utf8');
const workspaceSource = readFileSync(
  new URL('./YazilimciWorkspace.tsx', import.meta.url),
  'utf8',
);
const stylesSource = readFileSync(
  new URL('./YazilimciPage.module.css', import.meta.url),
  'utf8',
);

describe('AI Yazılımcı visual theme safeguards', () => {
  it('scopes the dark studio theme to the AI Yazılımcı workspace', () => {
    expect(workspaceSource).toContain('data-yazilimci-workspace="true"');
    expect(workspaceSource).toContain('data-visual-theme="studio"');
    expect(stylesSource).toContain(
      '.page[data-yazilimci-workspace="true"][data-visual-theme="studio"] .studioDashboard',
    );
    expect(stylesSource).toContain('color: #f4fbfd !important;');
  });

  it('supports an authenticated-data-free local preview', () => {
    expect(pageSource).toContain('return <YazilimciWorkspace />;');
    expect(workspaceSource).toContain('initialData?: HubData');
    expect(workspaceSource).toContain('if (initialData) return;');
    expect(workspaceSource).toContain('useState<HubData | null>(initialData ?? null)');
  });

  it('keeps the approved light gallery and website cards readable', () => {
    expect(stylesSource).toContain('article.websiteCard');
    expect(stylesSource).toContain('background: #fff !important;');
    expect(stylesSource).toContain('color: #10233d !important;');
    expect(stylesSource).toContain('color: #51677c !important;');
  });

  it('preserves the three visually distinct studio actions', () => {
    expect(workspaceSource).toContain('ÖNERİLEN');
    expect(workspaceSource).toContain('ALAN ADIM VAR');
    expect(workspaceSource).toContain('HESAPLARI HAZIRLA');
    expect(workspaceSource).toContain('className={styles.connectionMiniFlow}');
    expect(workspaceSource).toContain('className={styles.socialProgress}');
    expect(stylesSource).toContain('.createWebsiteCard {');
    expect(stylesSource).toContain('.connectWebsiteCard {');
    expect(stylesSource).toContain('.socialSetupCard {');
  });

  it('renders detailed professional cards from the dedicated photo asset', () => {
    expect(workspaceSource).toContain('data-preview-slot={previewSlot}');
    expect(workspaceSource).toContain('100 TASARIM');
    expect(workspaceSource).toContain('7 SAYFA');
    expect(workspaceSource).toContain('MOBİL UYUMLU');
    expect(stylesSource).toContain('/yazilimci/property-preview-sprite.png');
    expect(stylesSource).toContain('.paletteSwatches');
  });

  it('provides names and pressed state for compact gallery controls', () => {
    expect(workspaceSource).toContain('aria-label="Kart görünümü"');
    expect(workspaceSource).toContain('aria-label="Liste görünümü"');
    expect(workspaceSource).toContain(
      'aria-pressed={websiteCardFilter === "templates"}',
    );
  });
});
