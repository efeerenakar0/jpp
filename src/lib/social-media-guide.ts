import type { SocialPlatformId } from './developer-workspace';

export type SocialPlatformGuide = {
  id: SocialPlatformId;
  name: string;
  shortName: string;
  purpose: string;
  startUrl: string;
  color: string;
  steps: string[];
  checklist: string[];
};

export const SOCIAL_MEDIA_GUIDES: SocialPlatformGuide[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    shortName: 'IG',
    purpose: 'Portföy fotoğrafları, Reels ve bölge tanıtımları',
    startUrl: 'https://www.instagram.com/accounts/emailsignup/',
    color: '#e879f9',
    steps: [
      'Marka adınıza yakın, kolay yazılan bir kullanıcı adı seçin.',
      'Hesabı profesyonel hesaba çevirip “Emlak” kategorisini seçin.',
      'Logo, telefon, web sitesi ve hizmet bölgenizi profile ekleyin.',
      'İki aşamalı doğrulamayı açın ve ilk üç portföyünüzü paylaşın.',
    ],
    checklist: ['Profil fotoğrafı', 'Biyografi', 'İletişim düğmesi', '2 adımlı doğrulama'],
  },
  {
    id: 'facebook',
    name: 'Facebook',
    shortName: 'f',
    purpose: 'Kurumsal sayfa, yerel topluluklar ve reklamlar',
    startUrl: 'https://www.facebook.com/pages/create',
    color: '#60a5fa',
    steps: [
      'Kişisel hesabınızdan işletmeniz için yeni bir Sayfa oluşturun.',
      'Kategoriye “Emlak Şirketi” veya “Gayrimenkul Danışmanı” yazın.',
      'Adres, telefon, çalışma saatleri ve WhatsApp bağlantısını ekleyin.',
      'Sayfa erişimlerini yalnızca güvendiğiniz ekip üyelerine verin.',
    ],
    checklist: ['Sayfa adı', 'Kapak görseli', 'WhatsApp', 'Yönetici yetkileri'],
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    shortName: 'TT',
    purpose: 'Kısa portföy turları ve hızlı bölge içerikleri',
    startUrl: 'https://www.tiktok.com/signup',
    color: '#67e8f9',
    steps: [
      'İşletme e-postanızla hesap açın ve marka kullanıcı adını alın.',
      'Hesabı İşletme Hesabı olarak ayarlayın.',
      'Biyografiye hizmet bölgenizi ve iletişim bağlantınızı ekleyin.',
      'Dikey formatta 15–45 saniyelik portföy turları yayınlayın.',
    ],
    checklist: ['İşletme hesabı', 'Biyografi', 'Bağlantı', 'İlk video'],
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    shortName: 'in',
    purpose: 'Kurumsal güven, ekip ve iş ortaklıkları',
    startUrl: 'https://www.linkedin.com/company/setup/new/',
    color: '#38bdf8',
    steps: [
      'Kişisel profilinizden şirket sayfası oluşturun.',
      'Sektör, şirket büyüklüğü, logo ve slogan bilgilerini tamamlayın.',
      'Ekip üyelerinin şirket sayfasını profillerine eklemesini sağlayın.',
      'Başarı hikâyeleri, piyasa verileri ve yeni portföyleri paylaşın.',
    ],
    checklist: ['Şirket sayfası', 'Logo', 'Açıklama', 'Ekip bağlantıları'],
  },
  {
    id: 'youtube',
    name: 'YouTube',
    shortName: 'YT',
    purpose: 'Uzun portföy turları ve bilgilendirici videolar',
    startUrl: 'https://www.youtube.com/create_channel',
    color: '#fb7185',
    steps: [
      'İşletme Google hesabınızla bir marka kanalı oluşturun.',
      'Logo, kapak görseli, açıklama ve iletişim e-postasını ekleyin.',
      'Kanal doğrulamasını tamamlayıp özel küçük resimleri açın.',
      'Portföy turu, bölge rehberi ve müşteri soruları serileri hazırlayın.',
    ],
    checklist: ['Marka kanalı', 'Kapak', 'Kanal doğrulama', 'Oynatma listeleri'],
  },
  {
    id: 'x',
    name: 'X',
    shortName: 'X',
    purpose: 'Hızlı duyurular, piyasa notları ve gündem',
    startUrl: 'https://x.com/i/flow/signup',
    color: '#cbd5e1',
    steps: [
      'Marka adıyla hesap açıp işletme e-postasını doğrulayın.',
      'Logo, kısa açıklama, konum ve web adresini ekleyin.',
      'Sabit gönderide çalışma bölgenizi ve iletişim yolunuzu anlatın.',
      'Hesap güvenliğinden iki aşamalı doğrulamayı etkinleştirin.',
    ],
    checklist: ['Kullanıcı adı', 'Profil', 'Sabit gönderi', '2 adımlı doğrulama'],
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    shortName: 'P',
    purpose: 'Dekorasyon, mimari ve yaşam tarzı koleksiyonları',
    startUrl: 'https://www.pinterest.com/business/create/',
    color: '#f87171',
    steps: [
      'Ücretsiz işletme hesabı oluşturun.',
      'Logo, açıklama ve web sitesi bilgilerini ekleyin.',
      'Satılık, kiralık, villa ve dekorasyon için ayrı panolar açın.',
      'Her görseli ilgili portföy sayfasına bağlayın.',
    ],
    checklist: ['İşletme hesabı', 'Web doğrulama', 'Panolar', 'Bağlantılı pinler'],
  },
  {
    id: 'google-business',
    name: 'Google İşletme Profili',
    shortName: 'G',
    purpose: 'Google Haritalar, yorumlar ve yerel aramalar',
    startUrl: 'https://business.google.com/create',
    color: '#fbbf24',
    steps: [
      'Google hesabınızla işletme profilinizi oluşturun veya sahiplenin.',
      'Gerçek şirket adı, kategori, telefon ve hizmet bölgesini ekleyin.',
      'Google’ın istediği doğrulama yöntemini tamamlayın.',
      'Fotoğraf ekleyin; gelen yorumlara düzenli ve nazik yanıt verin.',
    ],
    checklist: ['Adres/hizmet alanı', 'Telefon', 'Doğrulama', 'Yorum takibi'],
  },
  {
    id: 'whatsapp-business',
    name: 'WhatsApp Business',
    shortName: 'WA',
    purpose: 'Hızlı müşteri iletişimi ve portföy kataloğu',
    startUrl: 'https://www.whatsapp.com/business/',
    color: '#34d399',
    steps: [
      'İşletmeye ait ve sürekli erişebildiğiniz telefon numarasını seçin.',
      'WhatsApp Business uygulamasını kurup numarayı doğrulayın.',
      'Şirket açıklaması, çalışma saati, adres ve web sitesini ekleyin.',
      'Karşılama, uzakta mesajı ve hızlı yanıtları hazırlayın.',
    ],
    checklist: ['İşletme numarası', 'Profil', 'Otomatik yanıt', 'İki adımlı PIN'],
  },
  {
    id: 'telegram',
    name: 'Telegram',
    shortName: 'TG',
    purpose: 'Portföy duyuru kanalı ve topluluk iletişimi',
    startUrl: 'https://telegram.org/',
    color: '#7dd3fc',
    steps: [
      'Telefon numaranızla hesabı açın ve iki adımlı doğrulamayı etkinleştirin.',
      'Şirketiniz için herkese açık bir duyuru kanalı oluşturun.',
      'Kanal adı, kullanıcı adı, açıklama ve logoyu tamamlayın.',
      'Yeni portföyleri kısa açıklama ve güvenli bağlantıyla paylaşın.',
    ],
    checklist: ['Kanal', 'Kullanıcı adı', 'Logo', '2 adımlı doğrulama'],
  },
];

export function getSocialMediaGuide(id: SocialPlatformId) {
  return SOCIAL_MEDIA_GUIDES.find((guide) => guide.id === id) ?? SOCIAL_MEDIA_GUIDES[0];
}
