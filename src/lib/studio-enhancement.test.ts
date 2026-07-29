import { describe, expect, it } from 'vitest';

import {
  DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
  STUDIO_ENHANCEMENT_PRESETS,
  STUDIO_NEGATIVE_PROMPT,
} from './studio-enhancement';

describe('studio enhancement prompts', () => {
  it('uses the professional real-estate instruction as the default prompt', () => {
    expect(DEFAULT_STUDIO_ENHANCEMENT_PROMPT).toContain(
      'profesyonel, tam kare bir kamerayla'
    );
    expect(DEFAULT_STUDIO_ENHANCEMENT_PROMPT).toContain(
      'yapısını değiştirme'
    );
  });

  it('offers every requested Turkish preset with editable prompt text', () => {
    expect(STUDIO_ENHANCEMENT_PRESETS.map((preset) => preset.label)).toEqual([
      'Profesyonel kamera',
      'Emlak fotoğrafı',
      'Işık ve renk düzeltme',
      'Akşam çekimi',
      'Doğal ve gerçekçi',
      'Özel talimat',
    ]);

    expect(
      STUDIO_ENHANCEMENT_PRESETS.every(
        (preset) => preset.prompt.length > 0 || preset.id === 'custom'
      )
    ).toBe(true);
  });

  it('blocks structural changes and synthetic additions in the negative prompt', () => {
    expect(STUDIO_NEGATIVE_PROMPT).toContain('altered architecture');
    expect(STUDIO_NEGATIVE_PROMPT).toContain('new objects');
    expect(STUDIO_NEGATIVE_PROMPT).toContain('watermark');
  });
});
