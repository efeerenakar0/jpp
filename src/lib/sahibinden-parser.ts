/**
 * Sahibinden.com İlan Link Parser
 * URL'den temel ilan bilgilerini çıkarır
 * 
 * Not: Sahibinden'in resmi API'si yoktur. Bu parser URL yapısından
 * ve kullanıcının manuel girişlerinden bilgi toplar.
 */

export interface ParsedListing {
  url: string;
  listingId: string | null;
  title: string;
  price: string | null;
  location: string | null;
  roomCount: string | null;
  area: string | null;
  category: string | null;
  isValid: boolean;
  ownerName?: string;
  error?: string;
}

/**
 * Sahibinden URL'sinin geçerli olup olmadığını kontrol eder
 */
export function isValidSahibindenUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'www.sahibinden.com' || parsed.hostname === 'sahibinden.com';
  } catch {
    return false;
  }
}

/**
 * URL yapısından temel bilgileri çıkarır
 * Örnek URL: https://www.sahibinden.com/ilan/emlak-konut-satilik-alanya-mahmutlar-da-deniz-manzarali-3-1-daire-1234567890
 */
export function parseListingUrl(url: string): ParsedListing {
  if (!isValidSahibindenUrl(url)) {
    return {
      url,
      listingId: null,
      title: '',
      price: null,
      location: null,
      roomCount: null,
      area: null,
      category: null,
      isValid: false,
      error: 'Geçersiz Sahibinden.com URL\'si. Lütfen geçerli bir ilan linki yapıştırın.',
    };
  }

  try {
    const parsed = new URL(url);
    const pathParts = parsed.pathname.split('/').filter(Boolean);

    // İlan ID'sini çıkar (URL'nin sonundaki sayısal kısım)
    const lastPart = pathParts[pathParts.length - 1] || '';
    const idMatch = lastPart.match(/(\d{5,})/);
    const listingId = idMatch ? idMatch[1] : null;

    // URL slug'ından başlık oluştur
    const slugPart = lastPart.replace(/-\d+$/, ''); // Sondaki ID'yi kaldır
    const title = slugPart
      .split('-')
      .filter(part => !['ilan', 'emlak', 'konut', 'satilik', 'kiralik'].includes(part))
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ')
      .trim() || 'İlan Başlığı';

    // Kategori çıkar
    let category: string | null = null;
    if (pathParts.includes('satilik')) category = 'Satılık';
    else if (pathParts.includes('kiralik')) category = 'Kiralık';

    // Oda sayısı çıkarmaya çalış
    const roomMatch = slugPart.match(/(\d\+\d)/);
    const roomCount = roomMatch ? roomMatch[1] : null;

    // Konum çıkarmaya çalış (bilinen bölge isimleri)
    const knownLocations = [
      'alanya', 'mahmutlar', 'avsallar', 'kestel', 'oba', 'cikcilli',
      'tosmur', 'kargicak', 'antalya', 'istanbul', 'ankara', 'izmir',
      'muratpasa', 'konyaalti', 'lara', 'kepez', 'dosemealti',
      'gazipaşa', 'demirtas', 'bektas', 'payallar'
    ];
    
    const slugLower = slugPart.toLowerCase();
    const foundLocations = knownLocations.filter(loc => slugLower.includes(loc));
    const location = foundLocations.length > 0 
      ? foundLocations.map(l => l.charAt(0).toUpperCase() + l.slice(1)).join(', ')
      : null;

    return {
      url,
      listingId,
      title,
      price: null, // Fiyat URL'den çıkarılamaz, manuel giriş gerekir
      location,
      roomCount,
      area: null, // Alan URL'den çıkarılamaz, manuel giriş gerekir
      category,
      isValid: true,
    };
  } catch {
    return {
      url,
      listingId: null,
      title: '',
      price: null,
      location: null,
      roomCount: null,
      area: null,
      category: null,
      isValid: false,
      error: 'URL işlenirken bir hata oluştu.',
    };
  }
}

/**
 * Kullanıcının manuel girdiği bilgilerle parse edilmiş veriyi birleştirir
 */
export function mergeWithManualData(
  parsed: ParsedListing,
  manual: {
    title?: string;
    price?: string;
    location?: string;
    roomCount?: string;
    area?: string;
    ownerName?: string;
  }
): ParsedListing & { ownerName?: string } {
  return {
    ...parsed,
    title: manual.title || parsed.title,
    price: manual.price || parsed.price,
    location: manual.location || parsed.location,
    roomCount: manual.roomCount || parsed.roomCount,
    area: manual.area || parsed.area,
    ownerName: manual.ownerName,
  };
}
