export type DeveloperSiteOptionId = 'new' | 'existing';

export type DeveloperSiteOption = {
  id: DeveloperSiteOptionId;
  kicker: string;
  title: string;
  description: string;
  benefits: readonly string[];
  recommended: boolean;
};

export const DEVELOPER_SITE_OPTIONS = [
  {
    id: 'new',
    kicker: 'YENİ ÜCRETSİZ SİTE',
    title: 'Yeni ücretsiz web sitesi oluştur',
    description:
      'Markanıza uygun başlangıç sitesi ücretsiz hazırlanır ve mevcut alan adınıza bağlanabilir.',
    benefits: [
      'Portföylerinizle güvenli ve sürekli entegrasyon',
      'Arama motorları için hazır SEO temeli',
      'Kurulum rehberi ve teknik teslim paketi',
    ],
    recommended: true,
  },
  {
    id: 'existing',
    kicker: 'MEVCUT SİTE',
    title: 'Mevcut web sitemi bağla',
    description:
      'Mevcut tasarımınızı koruyarak portföy akışını ve yayın bağlantısını güvenli teslim süreciyle kurun.',
    benefits: [
      'Kaynak paket güvenlik kontrolü',
      'İnsan onaylı entegrasyon iş emri',
      'Sürümlü sonuç ve kurulum rehberi',
    ],
    recommended: false,
  },
] as const satisfies readonly DeveloperSiteOption[];

export function getDeveloperSiteOption(id: DeveloperSiteOptionId) {
  const option = DEVELOPER_SITE_OPTIONS.find((item) => item.id === id);
  if (!option) throw new Error('Site seçeneği bulunamadı.');
  return option;
}
