import { z } from 'zod';

export const DEVELOPER_THEME_IDS = [
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

export const developerThemeIdSchema = z.enum(DEVELOPER_THEME_IDS);
export type DeveloperThemeId = z.infer<typeof developerThemeIdSchema>;

export type DeveloperTheme = {
  id: DeveloperThemeId;
  name: string;
  mood: string;
  description: string;
  layout: 'cinematic' | 'editorial' | 'minimal' | 'grid' | 'classic';
  colors: {
    background: string;
    surface: string;
    ink: string;
    muted: string;
    accent: string;
    accentSoft: string;
  };
};

export const DEVELOPER_THEMES: readonly DeveloperTheme[] = [
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
];

export const DEFAULT_DEVELOPER_THEME_ID: DeveloperThemeId = 'midnight-estate';

export function getDeveloperTheme(id: unknown) {
  const parsed = developerThemeIdSchema.safeParse(id);
  return (
    DEVELOPER_THEMES.find((theme) => theme.id === parsed.data) ??
    DEVELOPER_THEMES[0]
  );
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
