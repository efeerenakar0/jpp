import { describe, expect, it } from 'vitest';
import {
  BANNERBEAR_POSTER_PRESETS,
  BANNERBEAR_POSTER_TEMPLATES,
  bannerbearPresetsForFormat,
  defaultBannerbearPreset,
  findBannerbearTemplate,
  nextBannerbearPreset,
} from './bannerbear-poster-catalog';

describe('Bannerbear poster catalog', () => {
  it('yalnızca gerçekten farklı Bannerbear şablonlarını sunar', () => {
    expect(BANNERBEAR_POSTER_PRESETS).toHaveLength(17);
    expect(new Set(BANNERBEAR_POSTER_PRESETS.map((preset) => preset.id)).size).toBe(17);
    expect(new Set(BANNERBEAR_POSTER_PRESETS.map((preset) => preset.templateUid)).size).toBe(17);
    expect(bannerbearPresetsForFormat('post')).toHaveLength(13);
    expect(bannerbearPresetsForFormat('story')).toHaveLength(4);
  });

  it('her görünümü geçerli bir Bannerbear şablonuna ve renk sistemine bağlar', () => {
    for (const preset of BANNERBEAR_POSTER_PRESETS) {
      const template = findBannerbearTemplate(preset.templateUid);
      expect(template?.format).toBe(preset.format);
      expect(preset.palette.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(preset.palette.text).toMatch(/^#[0-9a-f]{6}$/i);
    }
    expect(BANNERBEAR_POSTER_TEMPLATES).toHaveLength(17);
    expect(defaultBannerbearPreset('post').format).toBe('post');
    expect(defaultBannerbearPreset('story').format).toBe('story');
  });

  it('otomatik rotasyonda aynı gerçek şablonu art arda seçmez', () => {
    const first = defaultBannerbearPreset('post');
    const second = nextBannerbearPreset('post', first.id);
    expect(second.id).not.toBe(first.id);
    expect(second.templateUid).not.toBe(first.templateUid);
  });
});
