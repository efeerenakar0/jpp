export const primaryModuleDefinitions = [
  {
    name: 'Komuta Merkezi',
    href: '/fabrika',
    description: 'Genel Müdür',
  },
  {
    name: 'Yazılımcı',
    href: '/fabrika/yazilimci',
    description: 'Site Oluşturucu & SEO',
    moduleNumber: 1,
  },
  {
    name: 'Portföyler',
    href: '/fabrika/portfoyler',
    description: 'Portföy Yönetimi',
  },
  {
    name: 'Avcı',
    href: '/fabrika/avci',
    description: 'Ücretli Portföy Toplayıcı',
    moduleNumber: 2,
    requiresHunter: true,
  },
  {
    name: 'Pazarlamacı',
    href: '/fabrika/pazarlamaci',
    description: 'Reklam Ekibi',
    moduleNumber: 3,
  },
  {
    name: 'Asistan',
    href: '/fabrika/asistan',
    description: 'CRM & İletişim',
    moduleNumber: 4,
  },
  {
    name: 'Stüdyo',
    href: '/fabrika/studyo',
    description: 'Görsel Optimizasyon',
    moduleNumber: 5,
  },
  {
    name: 'Belge Merkezi',
    href: '/fabrika/belgeler',
    description: 'Sözleşme ve belge oluşturma',
    moduleNumber: 6,
  },
] as const;
