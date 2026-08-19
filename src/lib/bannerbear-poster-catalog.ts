export type BannerbearPosterFormat = 'post' | 'story';

/** UI-only sentinel. The server always receives a resolved, real template preset. */
export const AUTO_BANNERBEAR_PRESET_ID = 'auto';

export type BannerbearPosterPalette = {
  id: string;
  name: string;
  background: string;
  surface: string;
  text: string;
  secondaryText: string;
  accent: string;
  accentSoft: string;
};

export type BannerbearPosterTemplate = {
  uid: string;
  name: string;
  format: BannerbearPosterFormat;
  width: number;
  height: number;
  tone: 'black-gold' | 'brown-beige' | 'blue-gold' | 'clean';
};

export type BannerbearPosterPreset = {
  id: string;
  name: string;
  category: string;
  format: BannerbearPosterFormat;
  templateUid: string;
  palette: BannerbearPosterPalette;
};

export const BANNERBEAR_POSTER_TEMPLATES: BannerbearPosterTemplate[] = [
  { uid: 'PaB8NZzp69wGjnMxKm', name: 'Siyah Altın · Klasik', format: 'post', width: 1000, height: 1000, tone: 'black-gold' },
  { uid: 'BvynkKjGBgApZDoX24', name: 'Kahve Bej · Adres', format: 'post', width: 1000, height: 1000, tone: 'brown-beige' },
  { uid: 'K4RDA9dpLqQ5WqyxrQ', name: 'Temiz · İletişim', format: 'post', width: 1000, height: 1000, tone: 'clean' },
  { uid: '6EZ9nQX0lD90WwqAgz', name: 'Temiz · Özellikler', format: 'post', width: 1000, height: 1000, tone: 'clean' },
  { uid: 'wxrj1vqpn8k0MzbXyn', name: 'Mavi Altın · Danışman', format: 'post', width: 1000, height: 1000, tone: 'blue-gold' },
  { uid: 'LQAYqDP5m7bGZrkoXa', name: 'Kahve Bej · Premium', format: 'post', width: 1000, height: 1000, tone: 'brown-beige' },
  { uid: 'Kax9mYepj8q0g8bAnB', name: 'Kahve Bej · Özellikler', format: 'post', width: 1000, height: 1000, tone: 'brown-beige' },
  { uid: 'xXlOo120ELz5YBbwVR', name: 'Kahve Bej · Kolaj', format: 'post', width: 1000, height: 1000, tone: 'brown-beige' },
  { uid: 'xNYLwoO5MdXpj2vDVr', name: 'Kahve Bej · Çağrı', format: 'post', width: 1000, height: 1000, tone: 'brown-beige' },
  { uid: 'YeNJ2OA5aQa5ZlmW1Q', name: 'Siyah Altın · Özellikler', format: 'post', width: 1000, height: 1000, tone: 'black-gold' },
  { uid: 'wJxjYK60799pOlZz9M', name: 'Siyah Altın · Kolaj', format: 'post', width: 1000, height: 1000, tone: 'black-gold' },
  { uid: 'qvQAbPxprjPpk219Er', name: 'Siyah Altın · İletişim', format: 'post', width: 1000, height: 1000, tone: 'black-gold' },
  { uid: 'zo31jZ90DoW5wbBLme', name: 'Mavi Altın · Modern', format: 'post', width: 1000, height: 1000, tone: 'blue-gold' },
  { uid: 'xDeB7V60on15rzoyZl', name: 'Temiz · Dikey Detay', format: 'story', width: 1000, height: 1500, tone: 'clean' },
  { uid: 'X42RlYgGkaX5VzQOLb', name: 'Mavi Altın · Dikey Kolaj', format: 'story', width: 1000, height: 1500, tone: 'blue-gold' },
  { uid: '8lnERJw5N4JGPX7rZ9', name: 'Kahve Bej · Dikey Kolaj', format: 'story', width: 1000, height: 1500, tone: 'brown-beige' },
  { uid: 'lxdAbmLGZJwGVyoanr', name: 'Siyah Altın · Dikey Kolaj', format: 'story', width: 1000, height: 1500, tone: 'black-gold' },
];

const PALETTES: Record<string, BannerbearPosterPalette> = {
  obsidian: { id: 'obsidian', name: 'Gece Altını', background: '#090b10', surface: '#151820', text: '#fffaf0', secondaryText: '#d6d0c4', accent: '#d9a441', accentSoft: '#f4dfaa' },
  sapphire: { id: 'sapphire', name: 'Safir', background: '#061a33', surface: '#0c2f55', text: '#f7fbff', secondaryText: '#c5d9ee', accent: '#e6b951', accentSoft: '#fff0b7' },
  ivory: { id: 'ivory', name: 'Fildişi', background: '#f6f1e8', surface: '#fffdf8', text: '#172238', secondaryText: '#5f6b7e', accent: '#b9853b', accentSoft: '#ead2a4' },
  terracotta: { id: 'terracotta', name: 'Toprak', background: '#2d1c18', surface: '#56372d', text: '#fff8ef', secondaryText: '#e6cfc0', accent: '#d99862', accentSoft: '#f3c39d' },
  emerald: { id: 'emerald', name: 'Zümrüt', background: '#071f1b', surface: '#123d34', text: '#f1fff9', secondaryText: '#bde2d4', accent: '#c8a95c', accentSoft: '#f0d99a' },
  plum: { id: 'plum', name: 'Gece Mürdümü', background: '#211229', surface: '#42234c', text: '#fff8ff', secondaryText: '#dec8e5', accent: '#e4b65d', accentSoft: '#f5dda6' },
};

const CATEGORY_NAMES = [
  'Lüks Portföy', 'Yeni İlan', 'Hızlı Satış', 'Yatırım Fırsatı', 'Danışman Sunumu',
  'Premium Yaşam', 'Öne Çıkan Özellikler', 'Fotoğraf Kolajı', 'Randevu Çağrısı',
  'Seçkin Portföy', 'Modern Kolaj', 'Kurumsal İlan', 'Şehirli Modern',
];

function basePalette(template: BannerbearPosterTemplate) {
  if (template.tone === 'black-gold') return PALETTES.obsidian;
  if (template.tone === 'brown-beige') return PALETTES.terracotta;
  if (template.tone === 'blue-gold') return PALETTES.sapphire;
  return PALETTES.ivory;
}

function presetId(template: BannerbearPosterTemplate, palette: BannerbearPosterPalette) {
  return `${template.format}-${template.uid.slice(0, 8).toLowerCase()}-${palette.id}`;
}

function posterPresets() {
  const templates = BANNERBEAR_POSTER_TEMPLATES.filter((item) => item.format === 'post');
  return templates.map((template, index) => {
    const palette = basePalette(template);
    return {
      id: presetId(template, palette),
      name: `${CATEGORY_NAMES[index]} · ${palette.name}`,
      category: CATEGORY_NAMES[index],
      format: 'post' as const,
      templateUid: template.uid,
      palette,
    };
  });
}

function storyPresets() {
  const templates = BANNERBEAR_POSTER_TEMPLATES.filter((item) => item.format === 'story');
  return templates.map((template, index) => {
    const palette = basePalette(template);
    return {
      id: presetId(template, palette),
      name: `${['Dikey Detay', 'Dikey Kolaj', 'Dikey Premium', 'Dikey Vitrin'][index]} · ${palette.name}`,
      category: 'Hikâye',
      format: 'story' as const,
      templateUid: template.uid,
      palette,
    };
  });
}

/**
 * Only genuinely different Bannerbear layouts are exposed. Recolouring an
 * arbitrary template was removed because it could turn light text invisible
 * on a light panel while pretending to be a distinct design.
 */
export const BANNERBEAR_POSTER_PRESETS: BannerbearPosterPreset[] = [...posterPresets(), ...storyPresets()];

export function bannerbearTemplatesForFormat(format: BannerbearPosterFormat) {
  return BANNERBEAR_POSTER_TEMPLATES.filter((template) => template.format === format);
}

export function bannerbearPresetsForFormat(format: BannerbearPosterFormat) {
  return BANNERBEAR_POSTER_PRESETS.filter((preset) => preset.format === format);
}

export function defaultBannerbearTemplate(format: BannerbearPosterFormat) {
  const template = bannerbearTemplatesForFormat(format)[0];
  if (!template) throw new Error(`Bannerbear ${format} şablonu bulunamadı.`);
  return template;
}

export function defaultBannerbearPreset(format: BannerbearPosterFormat) {
  const preset = bannerbearPresetsForFormat(format)[0];
  if (!preset) throw new Error(`Bannerbear ${format} görünümü bulunamadı.`);
  return preset;
}

export function findBannerbearTemplate(uid: string) {
  return BANNERBEAR_POSTER_TEMPLATES.find((template) => template.uid === uid) ?? null;
}

export function findBannerbearPreset(id: string) {
  return BANNERBEAR_POSTER_PRESETS.find((preset) => preset.id === id) ?? null;
}

export function findFirstPresetForTemplate(uid: string, format: BannerbearPosterFormat) {
  return BANNERBEAR_POSTER_PRESETS.find((preset) => preset.templateUid === uid && preset.format === format) ?? null;
}

/** Returns the next genuinely different layout and wraps at the end. */
export function nextBannerbearPreset(
  format: BannerbearPosterFormat,
  previousPresetId?: string | null
) {
  const presets = bannerbearPresetsForFormat(format);
  if (!presets.length) {
    throw new Error(`Bannerbear ${format} görünümü bulunamadı.`);
  }
  const previous = previousPresetId
    ? findBannerbearPreset(previousPresetId)
    : null;
  const previousIndex = previous
    ? presets.findIndex((preset) => preset.templateUid === previous.templateUid)
    : -1;
  return presets[(previousIndex + 1) % presets.length];
}
