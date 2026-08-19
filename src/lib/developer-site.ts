import { z } from 'zod';

const LEGACY_DEVELOPER_THEMES = [
  'midnight-estate',
  'coastal-living',
  'monaco-luxe',
  'nordic-space',
  'editorial-ink',
  'terracotta-home',
  'emerald-reserve',
  'skyline-pro',
  'gallery-white',
  'desert-modern',
  'cobalt-grid',
  'rosewood-signature',
  'brutalist-key',
  'sage-habitat',
  'golden-hour',
  'azure-resort',
  'graphite-office',
  'art-deco-key',
  'soft-studio',
  'mediterranean',
  'glass-house',
  'newspaper',
  'kinetic-coral',
  'forest-lodge',
  'classic-court',
] as const;

const EXTRA_THEME_COLLECTIONS = [
  {
    mood: 'Riviera & resort', description: 'Deniz, marina ve yazlık yaşamı rafine bir seyahat diliyle sunar.',
    colors: { background: '#edf9fb', surface: '#ffffff', ink: '#103840', muted: '#648087', accentSoft: '#d6f0f1' },
    editions: [
      ['pearl-marina', 'Pearl Marina', '#008f9c'], ['aegean-breeze', 'Aegean Breeze', '#1479a8'],
      ['lagoon-club', 'Lagoon Club', '#00a68f'], ['island-atelier', 'Island Atelier', '#4169a6'],
      ['blue-horizon', 'Blue Horizon', '#087eb8'],
    ],
  },
  {
    mood: 'Şehir & yatırım', description: 'Yatırım verisini, lokasyon gücünü ve şehir portföyünü net bir kurumsal ritimle anlatır.',
    colors: { background: '#eef2f7', surface: '#ffffff', ink: '#17243a', muted: '#66748a', accentSoft: '#dce5f2' },
    editions: [
      ['metro-axis', 'Metro Axis', '#3457d5'], ['tower-one', 'Tower One', '#005f99'],
      ['district-nine', 'District Nine', '#6f42c1'], ['capital-square', 'Capital Square', '#b44537'],
      ['urban-ledger', 'Urban Ledger', '#246b5b'],
    ],
  },
  {
    mood: 'Butik & couture', description: 'Kişisel danışmanlığı moda evi inceliği ve yüksek temaslı hizmet diliyle öne çıkarır.',
    colors: { background: '#21151a', surface: '#301f26', ink: '#fff7f1', muted: '#cfb6bd', accentSoft: '#50333d' },
    editions: [
      ['maison-rouge', 'Maison Rouge', '#d27b71'], ['velvet-key', 'Velvet Key', '#c9a463'],
      ['private-address', 'Private Address', '#d69ab1'], ['atelier-living', 'Atelier Living', '#b994db'],
      ['signature-noir', 'Signature Noir', '#e0c28b'],
    ],
  },
  {
    mood: 'Doğa & yavaş yaşam', description: 'Doğal malzemeleri, bahçeli evleri ve sakin yaşamı dokulu, insancıl bir anlatımla işler.',
    colors: { background: '#eff2e8', surface: '#fafbf6', ink: '#2b382b', muted: '#718071', accentSoft: '#dfe7d4' },
    editions: [
      ['olive-grove', 'Olive Grove', '#71853d'], ['pine-retreat', 'Pine Retreat', '#376b50'],
      ['stone-garden', 'Stone Garden', '#86715a'], ['meadow-house', 'Meadow House', '#6e944f'],
      ['earthline', 'Earthline', '#9b6548'],
    ],
  },
  {
    mood: 'Proptech & dinamik', description: 'Akıllı filtreleri, hızlı karar akışını ve teknoloji odaklı portföy deneyimini görünür kılar.',
    colors: { background: '#08152c', surface: '#102343', ink: '#f5f8ff', muted: '#9fb1d1', accentSoft: '#193b68' },
    editions: [
      ['pixel-estate', 'Pixel Estate', '#51e1ff'], ['proptech-one', 'Proptech One', '#65ffb7'],
      ['vector-homes', 'Vector Homes', '#8f8cff'], ['data-district', 'Data District', '#ffb454'],
      ['neon-address', 'Neon Address', '#ff68bf'],
    ],
  },
  {
    mood: 'Editoryal & kültürel', description: 'Portföyleri ilan değil; röportaj, mahalle rehberi ve yaşam kültürü dosyası gibi sunar.',
    colors: { background: '#f0ebdf', surface: '#fffdf7', ink: '#1a1916', muted: '#706b61', accentSoft: '#e5dacc' },
    editions: [
      ['habitat-review', 'Habitat Review', '#9c342b'], ['city-edition', 'City Edition', '#1f5a78'],
      ['dwelling-paper', 'Dwelling Paper', '#ac6b27'], ['address-journal', 'Address Journal', '#556b45'],
      ['modern-living-review', 'Modern Living Review', '#714c7d'],
    ],
  },
  {
    mood: 'Minimal & mimari', description: 'Geniş boşluk, hassas tipografi ve malzeme detaylarıyla mimariyi başrole taşır.',
    colors: { background: '#f5f5f2', surface: '#ffffff', ink: '#1d2222', muted: '#747b79', accentSoft: '#e5e7e4' },
    editions: [
      ['pure-form', 'Pure Form', '#252f30'], ['quiet-volume', 'Quiet Volume', '#596b68'],
      ['line-and-light', 'Line & Light', '#8a765e'], ['white-canvas', 'White Canvas', '#4a5c72'],
      ['spatial-notes', 'Spatial Notes', '#785e68'],
    ],
  },
  {
    mood: 'Miras & klasik', description: 'Köklü marka güvenini, tarihi mülkleri ve seçkin koleksiyonları zamansız bir düzenle anlatır.',
    colors: { background: '#141c27', surface: '#202a38', ink: '#fff8e8', muted: '#b7bdc7', accentSoft: '#3a3d42' },
    editions: [
      ['palazzo-heritage', 'Palazzo Heritage', '#c9a861'], ['manor-and-co', 'Manor & Co.', '#aebd85'],
      ['old-town-reserve', 'Old Town Reserve', '#cf806b'], ['legacy-court', 'Legacy Court', '#88a8c5'],
      ['royal-terrace', 'Royal Terrace', '#d0a1bd'],
    ],
  },
  {
    mood: 'Tropikal & canlı', description: 'Güneş, peyzaj ve açık hava yaşamını enerjik renkler ve tatil kulübü kurgusuyla sunar.',
    colors: { background: '#fff7e8', surface: '#fffdf7', ink: '#173f3b', muted: '#697f78', accentSoft: '#f2e4bd' },
    editions: [
      ['palm-house', 'Palm House', '#e56a3b'], ['equator-living', 'Equator Living', '#009c79'],
      ['sun-club', 'Sun Club', '#e6a213'], ['tropic-reserve', 'Tropic Reserve', '#287f9d'],
      ['coral-bay', 'Coral Bay', '#dc5d68'],
    ],
  },
  {
    mood: 'Alpine & inziva', description: 'Dağ evlerini, manzarayı ve dört mevsim yaşamı sıcak ama çağdaş bir lodge estetiğiyle işler.',
    colors: { background: '#e9eef0', surface: '#f9fbfb', ink: '#25343a', muted: '#6f7d82', accentSoft: '#d6e0e3' },
    editions: [
      ['chalet-collective', 'Chalet Collective', '#7b4e39'], ['snowline-estates', 'Snowline Estates', '#406d80'],
      ['alpine-frame', 'Alpine Frame', '#596b3e'], ['summit-lodge', 'Summit Lodge', '#986a3c'],
      ['north-peak', 'North Peak', '#4d5875'],
    ],
  },
  {
    mood: 'Endüstriyel & loft', description: 'Beton, çelik ve dönüştürülmüş mekânları ham dokular ve cesur ızgaralarla sergiler.',
    colors: { background: '#202224', surface: '#2b2e31', ink: '#f5f1e9', muted: '#a7a8a6', accentSoft: '#414346' },
    editions: [
      ['concrete-union', 'Concrete Union', '#ef6a3a'], ['steel-and-stone', 'Steel & Stone', '#b9cbcf'],
      ['loft-district', 'Loft District', '#e0ad45'], ['warehouse-living', 'Warehouse Living', '#ce5b5b'],
      ['raw-space', 'Raw Space', '#7fc0a3'],
    ],
  },
  {
    mood: 'Aile & mahalle', description: 'Güven, komşuluk ve gündelik hayatı sıcak, kolay anlaşılır ve davetkâr bir deneyimle buluşturur.',
    colors: { background: '#fff4ea', surface: '#fffdf9', ink: '#48342e', muted: '#866f67', accentSoft: '#f2ddcf' },
    editions: [
      ['nest-neighborhood', 'Nest & Neighborhood', '#d46b4d'], ['happy-doors', 'Happy Doors', '#2d927f'],
      ['warm-corner', 'Warm Corner', '#bc7c28'], ['home-story', 'Home Story', '#a85d79'],
      ['together-living', 'Together Living', '#5c78b0'],
    ],
  },
  {
    mood: 'Fütüristik & deneysel', description: 'Yeni nesil projeleri, dijital deneyimi ve geleceğin yaşam biçimlerini katmanlı bir sahnede sunar.',
    colors: { background: '#0c0b22', surface: '#171633', ink: '#f7f5ff', muted: '#aaa6cd', accentSoft: '#292653' },
    editions: [
      ['orbit-estate', 'Orbit Estate', '#7ce7ff'], ['prism-properties', 'Prism Properties', '#a982ff'],
      ['holo-homes', 'Holo Homes', '#64ffcf'], ['nova-district', 'Nova District', '#ff7ac8'],
      ['future-address', 'Future Address', '#ffc35c'],
    ],
  },
  {
    mood: 'Sanat & grafik', description: 'Mülkleri grafik tasarım, renk alanları ve kültürel afiş diliyle akılda kalıcı hale getirir.',
    colors: { background: '#f6f0df', surface: '#fffdf4', ink: '#171717', muted: '#666159', accentSoft: '#e8dcc3' },
    editions: [
      ['bauhaus-block', 'Bauhaus Block', '#d94732'], ['pop-property', 'Pop Property', '#2464d8'],
      ['memphis-homes', 'Memphis Homes', '#e49b18'], ['color-field', 'Color Field', '#6e50a8'],
      ['kinetic-space', 'Kinetic Space', '#168b78'],
    ],
  },
  {
    mood: 'Yerel & seçkin', description: 'Bölgenin mimarisini, yaşam kültürünü ve lokasyon bilgisini yerel bir yayın kimliğiyle öne çıkarır.',
    colors: { background: '#f4efe5', surface: '#fffdf8', ink: '#26333a', muted: '#707b7d', accentSoft: '#e7dbca' },
    editions: [
      ['istanbul-select', 'İstanbul Select', '#8f3040'], ['bodrum-edit', 'Bodrum Edit', '#247fa0'],
      ['cappadocia-stone', 'Cappadocia Stone', '#a85f3d'], ['ankara-prime', 'Ankara Prime', '#385a86'],
      ['izmir-coast', 'İzmir Coast', '#198a7b'],
    ],
  },
] as const;

type LegacyDeveloperThemeId = (typeof LEGACY_DEVELOPER_THEMES)[number];
type ExtraDeveloperThemeId = (typeof EXTRA_THEME_COLLECTIONS)[number]['editions'][number][0];
export type DeveloperThemeId = LegacyDeveloperThemeId | ExtraDeveloperThemeId;

export const DEVELOPER_THEME_IDS = [
  ...LEGACY_DEVELOPER_THEMES,
  ...EXTRA_THEME_COLLECTIONS.flatMap((collection) =>
    collection.editions.map(([id]) => id),
  ),
] as readonly DeveloperThemeId[];

const DEVELOPER_THEME_ID_SET = new Set<string>(DEVELOPER_THEME_IDS);
export const developerThemeIdSchema = z.custom<DeveloperThemeId>(
  (value) => typeof value === 'string' && DEVELOPER_THEME_ID_SET.has(value),
  'Geçersiz site tasarımı',
);

export type DeveloperThemeDesign = {
  hero: 'split' | 'panorama' | 'poster' | 'gallery' | 'frame' | 'stacked' | 'centered' | 'sidebar' | 'collage' | 'journal';
  navigation: 'floating' | 'rail' | 'masthead' | 'minimal' | 'boxed' | 'centered' | 'transparent' | 'split' | 'index' | 'compact';
  portfolio: 'masonry' | 'catalog' | 'spotlight' | 'cards' | 'ledger' | 'filmstrip' | 'bento' | 'list' | 'gallery' | 'tiles';
  typography: 'serif' | 'sans' | 'condensed' | 'mono' | 'humanist';
  shape: 'soft' | 'sharp' | 'arched' | 'pill' | 'cut';
  density: 'airy' | 'balanced' | 'compact';
};

export type DeveloperTheme = {
  id: DeveloperThemeId;
  name: string;
  mood: string;
  description: string;
  layout: 'cinematic' | 'editorial' | 'minimal' | 'grid' | 'classic';
  design: DeveloperThemeDesign;
  colors: {
    background: string;
    surface: string;
    ink: string;
    muted: string;
    accent: string;
    accentSoft: string;
  };
};

const LEGACY_THEME_DETAILS = [
  { id: 'midnight-estate', name: 'Midnight Estate', mood: 'Koyu & sinematik', description: 'Gece mavisi yüzeyler, güçlü başlıklar ve ışıklı detaylar.', layout: 'cinematic', colors: { background: '#07111f', surface: '#0f1c2e', ink: '#f7f4ed', muted: '#9caec4', accent: '#d8b36a', accentSoft: '#27344a' } },
  { id: 'coastal-living', name: 'Coastal Living', mood: 'Ferah & sahil', description: 'Turkuaz vurgular ve bol beyaz alanla tatil evi hissi.', layout: 'minimal', colors: { background: '#f3faf9', surface: '#ffffff', ink: '#123437', muted: '#648084', accent: '#16a6a0', accentSoft: '#d8f1ee' } },
  { id: 'monaco-luxe', name: 'Monaco Luxe', mood: 'Lüks & seçkin', description: 'Şampanya altını, bordo ve zarif serif tipografi.', layout: 'classic', colors: { background: '#160d12', surface: '#24151c', ink: '#fff8ed', muted: '#c8b2b9', accent: '#d6ad62', accentSoft: '#493342' } },
  { id: 'nordic-space', name: 'Nordic Space', mood: 'Sade & İskandinav', description: 'Sessiz gri tonları ve işlevsel, geniş bir düzen.', layout: 'minimal', colors: { background: '#f4f3ef', surface: '#ffffff', ink: '#1d2424', muted: '#6d7775', accent: '#56756e', accentSoft: '#dfe7e3' } },
  { id: 'editorial-ink', name: 'Editorial Ink', mood: 'Dergi & editoryal', description: 'Büyük manşetler ve asimetrik yayın tasarımı.', layout: 'editorial', colors: { background: '#f3efe6', surface: '#fffdf7', ink: '#181818', muted: '#68635b', accent: '#cf4b2f', accentSoft: '#f0d5c9' } },
  { id: 'terracotta-home', name: 'Terracotta Home', mood: 'Sıcak & doğal', description: 'Toprak tonlarıyla samimi ve güven veren vitrin.', layout: 'classic', colors: { background: '#f8efe8', surface: '#fffaf5', ink: '#402b24', muted: '#876d63', accent: '#be6245', accentSoft: '#efd3c5' } },
  { id: 'emerald-reserve', name: 'Emerald Reserve', mood: 'Prestij & doğa', description: 'Koyu yeşil, krem ve ince altın çizgiler.', layout: 'cinematic', colors: { background: '#09231d', surface: '#12342b', ink: '#f5f0df', muted: '#aac0b6', accent: '#d0ae62', accentSoft: '#29483f' } },
  { id: 'skyline-pro', name: 'Skyline Pro', mood: 'Kurumsal & keskin', description: 'Mavi veri panelleri ve şehirli bir ritim.', layout: 'grid', colors: { background: '#eef3fa', surface: '#ffffff', ink: '#12213b', muted: '#63728a', accent: '#275ee7', accentSoft: '#dbe6ff' } },
  { id: 'gallery-white', name: 'Gallery White', mood: 'Galeri & premium', description: 'Fotoğrafları öne çıkaran monokrom ve sakin bir sahne.', layout: 'editorial', colors: { background: '#f8f8f6', surface: '#ffffff', ink: '#111111', muted: '#777773', accent: '#111111', accentSoft: '#e7e7e2' } },
  { id: 'desert-modern', name: 'Desert Modern', mood: 'Modern & güneşli', description: 'Kum, kiremit ve siyahın mimari birlikteliği.', layout: 'grid', colors: { background: '#eee3d3', surface: '#f9f2e8', ink: '#26201b', muted: '#786b60', accent: '#b54f2f', accentSoft: '#dfc5b4' } },
  { id: 'cobalt-grid', name: 'Cobalt Grid', mood: 'Teknolojik & hızlı', description: 'Kobalt yüzeyler, net çizgiler ve hareketli kartlar.', layout: 'grid', colors: { background: '#071c4c', surface: '#102b67', ink: '#f5f8ff', muted: '#a8bce9', accent: '#67e5ff', accentSoft: '#1e4784' } },
  { id: 'rosewood-signature', name: 'Rosewood Signature', mood: 'Butik & zarif', description: 'Gül ağacı tonlarıyla kişisel danışman markası.', layout: 'classic', colors: { background: '#2a1217', surface: '#3a1b22', ink: '#fff1ed', muted: '#d0aaa5', accent: '#e29b82', accentSoft: '#5b3037' } },
  { id: 'brutalist-key', name: 'Brutalist Key', mood: 'Cesur & deneysel', description: 'Kalın çerçeveler, sert kontrast ve büyük tipografi.', layout: 'grid', colors: { background: '#f1ff2f', surface: '#ffffff', ink: '#101010', muted: '#484848', accent: '#ff4a21', accentSoft: '#dadada' } },
  { id: 'sage-habitat', name: 'Sage Habitat', mood: 'Yumuşak & huzurlu', description: 'Adaçayı tonlarında doğal ve dingin bir deneyim.', layout: 'minimal', colors: { background: '#edf1e8', surface: '#f9fbf6', ink: '#283228', muted: '#718071', accent: '#718e69', accentSoft: '#dce5d6' } },
  { id: 'golden-hour', name: 'Golden Hour', mood: 'Işıltılı & sıcak', description: 'Gün batımı renkleriyle enerjik bir portföy vitrini.', layout: 'cinematic', colors: { background: '#27120d', surface: '#3a1b12', ink: '#fff5df', muted: '#d9bda6', accent: '#ff9b42', accentSoft: '#60301d' } },
  { id: 'azure-resort', name: 'Azure Resort', mood: 'Tatil & ferah', description: 'Akdeniz mavisi ve beyazla yüksek enerjili sunum.', layout: 'editorial', colors: { background: '#eaf8ff', surface: '#ffffff', ink: '#07345a', muted: '#5e8097', accent: '#008bd2', accentSoft: '#ccecff' } },
  { id: 'graphite-office', name: 'Graphite Office', mood: 'Profesyonel & net', description: 'Grafit yüzeyler ve ölçülü lime vurgular.', layout: 'minimal', colors: { background: '#16191c', surface: '#202429', ink: '#f6f7f8', muted: '#a0a7ae', accent: '#b8e34b', accentSoft: '#343b35' } },
  { id: 'art-deco-key', name: 'Art Deco Key', mood: 'Klasik & gösterişli', description: 'Geometrik çizgilerle zamansız, premium bir kimlik.', layout: 'classic', colors: { background: '#0f2528', surface: '#17383b', ink: '#fff7df', muted: '#b9c8c6', accent: '#dcb968', accentSoft: '#315154' } },
  { id: 'soft-studio', name: 'Soft Studio', mood: 'Yaratıcı & pastel', description: 'Lavanta, mercan ve yuvarlak yüzeylerle dost canlısı.', layout: 'grid', colors: { background: '#f4efff', surface: '#fffaff', ink: '#30294a', muted: '#7a718e', accent: '#7757d8', accentSoft: '#e5dcff' } },
  { id: 'mediterranean', name: 'Mediterranean', mood: 'Akdeniz & otantik', description: 'Kireç beyazı, lacivert ve limon sarısı ayrıntılar.', layout: 'classic', colors: { background: '#f7f3e9', surface: '#fffdf7', ink: '#17334d', muted: '#6a7d88', accent: '#d59d20', accentSoft: '#eee0ae' } },
  { id: 'glass-house', name: 'Glass House', mood: 'Şeffaf & çağdaş', description: 'Sisli mavi arka planda hafif cam paneller.', layout: 'cinematic', colors: { background: '#dce9f2', surface: '#f7fbff', ink: '#173047', muted: '#64798b', accent: '#347ca8', accentSoft: '#c4dce9' } },
  { id: 'newspaper', name: 'The Property Journal', mood: 'Haber & güven', description: 'Gazete sütunlarıyla bilgi odaklı güçlü anlatım.', layout: 'editorial', colors: { background: '#eee9dd', surface: '#f9f6ed', ink: '#181713', muted: '#706d63', accent: '#9b2f25', accentSoft: '#e5ccc4' } },
  { id: 'kinetic-coral', name: 'Kinetic Coral', mood: 'Genç & hareketli', description: 'Mercan, mor ve keskin bloklarla sosyal bir enerji.', layout: 'grid', colors: { background: '#241439', surface: '#34204b', ink: '#fff6fc', muted: '#c7b1d6', accent: '#ff6b61', accentSoft: '#55335f' } },
  { id: 'forest-lodge', name: 'Forest Lodge', mood: 'Doğal & güvenilir', description: 'Orman tonları ve dokulu krem yüzeyler.', layout: 'cinematic', colors: { background: '#1a2a20', surface: '#263a2c', ink: '#f6f0df', muted: '#b3c0b5', accent: '#d79a58', accentSoft: '#3b5141' } },
  { id: 'classic-court', name: 'Classic Court', mood: 'Geleneksel & güçlü', description: 'Lacivert, beyaz ve kırmızıyla köklü kurum hissi.', layout: 'classic', colors: { background: '#f0f2f5', surface: '#ffffff', ink: '#16233b', muted: '#68758a', accent: '#a72b37', accentSoft: '#ead8dc' } },
] as const;

const HERO_STYLES = ['split', 'panorama', 'poster', 'gallery', 'frame', 'stacked', 'centered', 'sidebar', 'collage', 'journal'] as const;
const NAVIGATION_STYLES = ['floating', 'rail', 'masthead', 'minimal', 'boxed', 'centered', 'transparent', 'split', 'index', 'compact'] as const;
const PORTFOLIO_STYLES = ['masonry', 'catalog', 'spotlight', 'cards', 'ledger', 'filmstrip', 'bento', 'list', 'gallery', 'tiles'] as const;
const TYPOGRAPHY_STYLES = ['serif', 'sans', 'condensed', 'mono', 'humanist'] as const;
const SHAPE_STYLES = ['soft', 'sharp', 'arched', 'pill', 'cut'] as const;
const DENSITY_STYLES = ['airy', 'balanced', 'compact'] as const;

function designForIndex(index: number): DeveloperThemeDesign {
  return {
    hero: HERO_STYLES[index % HERO_STYLES.length],
    navigation: NAVIGATION_STYLES[Math.floor(index / 10) % NAVIGATION_STYLES.length],
    portfolio: PORTFOLIO_STYLES[(index * 3 + Math.floor(index / 10)) % PORTFOLIO_STYLES.length],
    typography: TYPOGRAPHY_STYLES[(index + Math.floor(index / 10)) % TYPOGRAPHY_STYLES.length],
    shape: SHAPE_STYLES[(index * 2 + Math.floor(index / 10)) % SHAPE_STYLES.length],
    density: DENSITY_STYLES[index % DENSITY_STYLES.length],
  };
}

const EXTRA_THEME_DETAILS = EXTRA_THEME_COLLECTIONS.flatMap((collection) =>
  collection.editions.map(([id, name, accent], editionIndex) => ({
    id,
    name,
    mood: collection.mood,
    description: collection.description,
    layout: (['cinematic', 'editorial', 'minimal', 'grid', 'classic'] as const)[editionIndex],
    colors: { ...collection.colors, accent },
  })),
);

export const DEVELOPER_THEMES: readonly DeveloperTheme[] = [
  ...LEGACY_THEME_DETAILS,
  ...EXTRA_THEME_DETAILS,
].map((theme, index) => ({
  id: theme.id as DeveloperThemeId,
  name: theme.name,
  mood: theme.mood,
  description: theme.description,
  layout: theme.layout,
  colors: theme.colors,
  design: designForIndex(index),
}));

export const DEFAULT_DEVELOPER_THEME_ID: DeveloperThemeId = 'midnight-estate';

export const FEATURED_DEVELOPER_THEME_IDS = DEVELOPER_THEME_IDS;

export type DeveloperThemeBlueprint = {
  architecture: string;
  navigation: string;
  portfolioPresentation: string;
  signature: string;
  signatureItems: readonly [string, string, string];
};

const FEATURED_THEME_BLUEPRINT_OVERRIDES: Partial<Record<DeveloperThemeId, DeveloperThemeBlueprint>> = {
  'midnight-estate': {
    architecture: 'Sinematik vitrin',
    navigation: 'İnce çerçeveli gece menüsü',
    portfolioPresentation: 'Öne çıkan ilan + koyu koleksiyon',
    signature: 'Gece seçkisi',
    signatureItems: ['Tam ekran mimari', 'Altın detaylar', 'Özel portföy odağı'],
  },
  'coastal-living': {
    architecture: 'Sahil yaşam rehberi',
    navigation: 'Ferah merkez menü',
    portfolioPresentation: 'Organik kıyı kartları',
    signature: 'Denize yakın yaşam',
    signatureItems: ['Kavisli galeri', 'Bölge odaklı arama', 'Tatil evi ritmi'],
  },
  'monaco-luxe': {
    architecture: 'Özel koleksiyon salonu',
    navigation: 'Simetrik concierge menüsü',
    portfolioPresentation: 'Mücevher kutusu koleksiyonu',
    signature: 'Private collection',
    signatureItems: ['Seçkin mülkler', 'Concierge iletişim', 'Prestij sunumu'],
  },
  'nordic-space': {
    architecture: 'İskandinav katalog',
    navigation: 'Sessiz tipografik menü',
    portfolioPresentation: 'Yatay mimari katalog',
    signature: 'Az ama öz',
    signatureItems: ['Geniş boşluk', 'İşlevsel filtre', 'Mimari ayrıntı'],
  },
  'editorial-ink': {
    architecture: 'Gayrimenkul dergisi',
    navigation: 'Gazete masthead menüsü',
    portfolioPresentation: 'Editoryal hikâye akışı',
    signature: 'Bu ayın dosyası',
    signatureItems: ['Büyük manşet', 'Asimetrik sayfa', 'Haber dili'],
  },
  'terracotta-home': {
    architecture: 'Yaşam hikâyesi',
    navigation: 'Sıcak yuvarlak menü',
    portfolioPresentation: 'Oda oda hikâye kartları',
    signature: 'Bir evden fazlası',
    signatureItems: ['Aile sıcaklığı', 'Doğal dokular', 'Mahalle hikâyeleri'],
  },
  'emerald-reserve': {
    architecture: 'Yatırım kulübü',
    navigation: 'Üyelik hissi veren menü',
    portfolioPresentation: 'Rezerv koleksiyon listesi',
    signature: 'Reserve access',
    signatureItems: ['Yatırım seçkisi', 'Gizli fırsatlar', 'Danışman önceliği'],
  },
  'skyline-pro': {
    architecture: 'Şehir yatırım terminali',
    navigation: 'Kurumsal hızlı erişim',
    portfolioPresentation: 'Veri odaklı şehir ızgarası',
    signature: 'Şehri verilerle okuyun',
    signatureItems: ['Getiri odağı', 'Yoğun portföy', 'Kurumsal görünüm'],
  },
  'gallery-white': {
    architecture: 'Mimari sanat galerisi',
    navigation: 'Küratör menüsü',
    portfolioPresentation: 'Tam görsel galeri duvarı',
    signature: 'Curated spaces',
    signatureItems: ['Fotoğraf önceliği', 'Monokrom sahne', 'Sergi düzeni'],
  },
  'desert-modern': {
    architecture: 'Mimari blok kompozisyonu',
    navigation: 'Ofset stüdyo menüsü',
    portfolioPresentation: 'Basamaklı proje blokları',
    signature: 'Güneş ve gölge',
    signatureItems: ['Keskin geometri', 'Kum paleti', 'Proje anlatısı'],
  },
  'cobalt-grid': {
    architecture: 'Dijital portföy ağı',
    navigation: 'Modüler teknoloji menüsü',
    portfolioPresentation: 'Yoğun akıllı ilan matrisi',
    signature: 'Property network',
    signatureItems: ['Hızlı tarama', 'Net filtreler', 'Teknoloji hissi'],
  },
  'rosewood-signature': {
    architecture: 'Danışman imza sitesi',
    navigation: 'Kişisel marka menüsü',
    portfolioPresentation: 'Danışman seçkisi',
    signature: 'Kişisel danışmanınız',
    signatureItems: ['İnsan odaklı', 'Butik hizmet', 'Güven ilişkisi'],
  },
  'brutalist-key': {
    architecture: 'Cesur ilan manifestosu',
    navigation: 'Blok komut menüsü',
    portfolioPresentation: 'Poster biçimli ilan duvarı',
    signature: 'Mülkü saklamayın',
    signatureItems: ['Yüksek kontrast', 'Dev tipografi', 'Hızlı aksiyon'],
  },
  'sage-habitat': {
    architecture: 'Sakin yaşam rotası',
    navigation: 'Organik kapsül menü',
    portfolioPresentation: 'Yumuşak yaşam koleksiyonu',
    signature: 'Doğal yaşam seçkisi',
    signatureItems: ['Huzurlu akış', 'Yeşil yaşam', 'Yumuşak formlar'],
  },
  'golden-hour': {
    architecture: 'Tam ekran duygu vitrini',
    navigation: 'Görsel üstü transparan menü',
    portfolioPresentation: 'Film şeridi portföyü',
    signature: 'Hayalinizdeki manzara',
    signatureItems: ['Tam ekran görsel', 'Gün batımı tonu', 'Duygusal anlatı'],
  },
};

const DESIGN_LABELS = {
  hero: {
    split: 'İkiye bölünmüş vitrin', panorama: 'Tam genişlik panorama', poster: 'Afiş manşet sahnesi', gallery: 'Küratörlü galeri açılışı', frame: 'Çerçeveli mimari odak', stacked: 'Katmanlı hikâye sahnesi', centered: 'Merkezi marka manifestosu', sidebar: 'Dikey keşif rotası', collage: 'Asimetrik fotoğraf kolajı', journal: 'Dergi kapak açılışı',
  },
  navigation: {
    floating: 'Yüzen kapsül menü', rail: 'Dikey ray navigasyonu', masthead: 'Editoryal masthead menü', minimal: 'Sessiz tipografik menü', boxed: 'Modüler kutu menü', centered: 'Simetrik merkez menü', transparent: 'Görsel üstü şeffaf menü', split: 'İki uçlu bölünmüş menü', index: 'Numaralı indeks menü', compact: 'Kompakt hızlı erişim',
  },
  portfolio: {
    masonry: 'Değişken yükseklikli portföy duvarı', catalog: 'Yatay mimari katalog', spotlight: 'Öne çıkan ilan sahnesi', cards: 'Zengin bilgi kartları', ledger: 'Yatırım veri defteri', filmstrip: 'Sinematik film şeridi', bento: 'Bento proje panosu', list: 'Editoryal ilan listesi', gallery: 'Tam görsel galeri', tiles: 'Yoğun keşif karoları',
  },
} as const;

export const DEVELOPER_THEME_BLUEPRINTS = Object.fromEntries(
  DEVELOPER_THEMES.map((theme) => {
    const override = FEATURED_THEME_BLUEPRINT_OVERRIDES[theme.id];
    return [theme.id, override ?? {
      architecture: `${theme.name} · ${DESIGN_LABELS.hero[theme.design.hero]}`,
      navigation: `${theme.name} · ${DESIGN_LABELS.navigation[theme.design.navigation]}`,
      portfolioPresentation: `${theme.name} · ${DESIGN_LABELS.portfolio[theme.design.portfolio]}`,
      signature: `${theme.name} seçkisi`,
      signatureItems: [
        DESIGN_LABELS.hero[theme.design.hero],
        DESIGN_LABELS.navigation[theme.design.navigation],
        DESIGN_LABELS.portfolio[theme.design.portfolio],
      ] as const,
    }];
  }),
) as Record<DeveloperThemeId, DeveloperThemeBlueprint>;

export function getDeveloperTheme(id: unknown) {
  const parsed = developerThemeIdSchema.safeParse(id);
  return (
    DEVELOPER_THEMES.find((theme) => theme.id === parsed.data) ??
    DEVELOPER_THEMES[0]
  );
}

export function getDeveloperThemeBlueprint(id: unknown): DeveloperThemeBlueprint {
  const theme = getDeveloperTheme(id);
  return DEVELOPER_THEME_BLUEPRINTS[theme.id];
}

const shortText = (max: number) => z.string().trim().max(max);

export const developerSiteContentSchema = z
  .object({
    hero: z.object({
      eyebrow: shortText(80),
      title: shortText(180),
      description: shortText(600),
      buttonLabel: shortText(60),
    }),
    about: z.object({
      enabled: z.boolean(),
      title: shortText(160),
      body: shortText(2_000),
    }),
    services: z.object({
      enabled: z.boolean(),
      title: shortText(160),
      intro: shortText(600),
      items: z.array(z.object({ title: shortText(100), description: shortText(500) })).min(1).max(6),
    }),
    blog: z.object({
      enabled: z.boolean(),
      title: shortText(160),
      intro: shortText(600),
      posts: z.array(z.object({ id: shortText(80), title: shortText(180), excerpt: shortText(700) })).max(6),
    }),
    faq: z.object({
      enabled: z.boolean(),
      title: shortText(160),
      items: z.array(z.object({ question: shortText(180), answer: shortText(900) })).max(8),
    }),
    contact: z.object({
      title: shortText(160),
      description: shortText(600),
    }),
  })
  .strict();

export type DeveloperSiteContent = z.infer<typeof developerSiteContentSchema>;

export function defaultDeveloperSiteContent(brandName = 'Markanız'): DeveloperSiteContent {
  return {
    hero: {
      eyebrow: 'GÜVENLE YENİ BİR BAŞLANGIÇ',
      title: 'Doğru gayrimenkulü, doğru danışmanla bulun.',
      description: `${brandName}, bölge bilgisi ve şeffaf iletişimle alım, satım ve kiralama sürecinizin her adımında yanınızda.`,
      buttonLabel: 'Portföyleri keşfedin',
    },
    about: {
      enabled: true,
      title: `${brandName} hakkında`,
      body: 'Müşterilerimizin ihtiyaçlarını dikkatle dinliyor, doğru portföyü doğru kişiyle buluşturuyoruz. Sürecin her adımında açık iletişim, güvenilir bilgi ve yerel uzmanlık sunuyoruz.',
    },
    services: {
      enabled: true,
      title: 'İhtiyacınıza göre çözüm',
      intro: 'Gayrimenkul yolculuğunuzun her aşamasında planlı ve anlaşılır destek alın.',
      items: [
        { title: 'Alım danışmanlığı', description: 'Bütçenize ve hedeflerinize uygun seçenekleri birlikte değerlendirelim.' },
        { title: 'Satış yönetimi', description: 'Portföyünüzü doğru sunum, doğru fiyat ve doğru alıcıyla buluşturalım.' },
        { title: 'Kiralama desteği', description: 'Kiracı ve mülk sahibi için güvenli, düzenli bir süreç yürütelim.' },
      ],
    },
    blog: {
      enabled: true,
      title: 'Gayrimenkul rehberi',
      intro: 'Doğru kararlar için kısa, açık ve güncel bilgiler.',
      posts: [
        { id: 'ilk-ev-rehberi', title: 'İlk evinizi alırken nelere dikkat etmelisiniz?', excerpt: 'Bütçeden tapu kontrolüne kadar kararınızı kolaylaştıracak temel adımlar.' },
        { id: 'dogru-fiyat', title: 'Bir portföyün doğru fiyatı nasıl belirlenir?', excerpt: 'Konum, emsal ve piyasa hareketlerini birlikte değerlendirmenin önemi.' },
        { id: 'kiralama-kontrol', title: 'Kiralama öncesi kısa kontrol listesi', excerpt: 'Sözleşmeden teslim tutanağına kadar gözden kaçmaması gerekenler.' },
      ],
    },
    faq: {
      enabled: true,
      title: 'Merak edilenler',
      items: [
        { question: 'Portföy bilgileri ne kadar güncel?', answer: 'Yayındaki portföyler Business CEO AI Portföy Uzmanı ile otomatik olarak güncellenir.' },
        { question: 'Görüşme talebi nasıl oluşturabilirim?', answer: 'Telefon veya WhatsApp bağlantısından ekibimize doğrudan ulaşabilirsiniz.' },
      ],
    },
    contact: {
      title: 'Birlikte konuşalım',
      description: 'Aradığınız gayrimenkulü veya satmak istediğiniz portföyü bize anlatın; size uygun yol haritasını birlikte oluşturalım.',
    },
  };
}

export function parseDeveloperSiteContent(value: unknown, brandName?: string) {
  const parsed = developerSiteContentSchema.safeParse(value);
  return parsed.success ? parsed.data : defaultDeveloperSiteContent(brandName);
}
