export const DEFAULT_STUDIO_ENHANCEMENT_PROMPT =
  'Bu görseli profesyonel bir emlak fotoğrafı gibi iyileştir fakat çekildiği zamanı kesinlikle değiştirme: gece fotoğrafı gece, mavi saat mavi saat, gündüz fotoğrafı gündüz kalsın. Fotoğrafın tamamını fazla aydınlatmak yerine mevcut lamba, aplik, tavan, pencere, havuz ve bahçe ışıklarını doğal ve davetkâr göster; yalnızca görünen ışık kaynaklarının çevresine gerçekçi ve hafif bir ışık yayılımı ekle. Genel pozlamayı ve gölge derinliğini kaynağa yakın tut. Doğal renk ayrımı, kontrollü kontrast, tonal derinlik, doğru beyaz dengesi, temiz detay ve hafif netlik kullan. Pencere, lamba, tavan, beyaz duvar, yansıma ve gökyüzü ayrıntılarını koru; patlamış beyaz, yapay HDR veya düz gri gölge oluşturma. Kadrajı, perspektifi, mimariyi, mobilyaları, nesneleri, manzarayı ve bütün mülk özelliklerini aynen koru. Olmayan yeni bir lamba, LED, pencere, mobilya, peyzaj veya mimari unsur ekleme; hiçbir fiziksel unsuru kaldırma, taşıma veya yeniden tasarlama.';

export const STUDIO_NEGATIVE_PROMPT =
  'text, letters, numbers, logo, watermark, people, new objects, removed objects, altered architecture, redesigned room, changed furniture, changed facade, fake windows, new pool, distorted geometry, oversaturated colors, excessive HDR, plastic textures, unrealistic lighting, blur, noise, low resolution';

export type StudioEnhancementPresetId =
  | 'professional-camera'
  | 'real-estate'
  | 'light-color'
  | 'evening'
  | 'natural'
  | 'custom';

export type StudioEnhancementPreset = {
  id: StudioEnhancementPresetId;
  label: string;
  description: string;
  prompt: string;
};

export const STUDIO_ENHANCEMENT_PRESETS: StudioEnhancementPreset[] = [
  {
    id: 'professional-camera',
    label: 'Profesyonel kamera',
    description: 'Tam kare kamera, doğal netlik ve dengeli pozlama.',
    prompt: DEFAULT_STUDIO_ENHANCEMENT_PROMPT,
  },
  {
    id: 'real-estate',
    label: 'Emlak fotoğrafı',
    description: 'Mimari çizgileri ve mülkün gerçek özelliklerini korur.',
    prompt:
      'Bu görseli profesyonel bir emlak ve mimari fotoğraf çekimi kalitesinde iyileştir. Odanın veya binanın gerçek planını, mimarisini, mobilyalarını, cepheyi, manzarayı ve bütün nesneleri aynı tut. Dikey çizgileri ve perspektifi doğal biçimde düzelt; iç ve dış mekân detaylarını temiz, dengeli ve davetkâr göster. Pozlama, beyaz dengesi, renk doğruluğu, netlik ve dinamik aralığı düzenle. Yeni nesne, insan, yazı, logo veya mimari unsur ekleme; hiçbir şeyi kaldırma ya da yeniden tasarlama.',
  },
  {
    id: 'light-color',
    label: 'Işık ve renk düzeltme',
    description: 'Pozlama, beyaz dengesi, gölge ve parlak alan odaklı.',
    prompt:
      'Görselin yalnızca ışık ve renk kalitesini doğal biçimde düzelt. Pozlamayı ve beyaz dengesini ayarla; gölgelerdeki ve parlak alanlardaki ayrıntıları geri getir. Renkleri gerçeğe sadık, nötr ve dengeli tut; aşırı doygunluk, sert kontrast, yapay HDR veya plastik doku oluşturma. Netliği ve detayları hafifçe iyileştir. Görseldeki mimariyi, mobilyaları, nesneleri, manzarayı, kadrajı ve bütün yapısal özellikleri değiştirme; yeni hiçbir unsur ekleme.',
  },
  {
    id: 'evening',
    label: 'Akşam çekimi',
    description: 'Mevcut akşam veya gece atmosferini ve ışıkları korur.',
    prompt:
      'Görsel zaten akşam, gece veya mavi saatte çekildiyse bu zamanı aynen koruyarak mevcut lamba, aplik, pencere, havuz ve bahçe ışıklarını sıcak, dengeli ve davetkâr göster. Gündüz fotoğrafını akşama, gece fotoğrafını gündüze dönüştürme; gökyüzünü değiştirme. Binanın, odanın, mobilyaların, havuzun, manzaranın ve diğer tüm nesnelerin yapısını ve konumunu aynen koru. Yeni lamba, pencere, havuz, insan, yazı, logo veya başka bir fiziksel unsur ekleme. Aşırı sinematik, yapay veya fazla doygun bir sonuç oluşturma.',
  },
  {
    id: 'natural',
    label: 'Doğal ve gerçekçi',
    description: 'Hafif dokunuşlarla gerçeğe en yakın sonuç.',
    prompt:
      'Bu görseli çok hafif ve doğal dokunuşlarla iyileştir. Gerçek görünümü, kadrajı, mimariyi, mobilyaları, nesneleri, malzeme dokularını ve manzarayı aynen koru. Yalnızca pozlama, beyaz dengesi, renk doğruluğu, gölge-parlak alan dengesi, hafif netlik ve görüntü temizliği üzerinde çalış. Yapay HDR, aşırı doygun renk, plastik doku veya gerçek dışı ışık kullanma. Yeni unsur, insan, metin, logo ya da filigran ekleme; mevcut hiçbir unsuru kaldırma.',
  },
  {
    id: 'custom',
    label: 'Özel talimat',
    description: 'Kendi iyileştirme talimatınızı sıfırdan yazın.',
    prompt: '',
  },
];
