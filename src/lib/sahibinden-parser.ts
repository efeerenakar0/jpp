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
    ownerPhone?: string;
  }
): ParsedListing & { ownerName?: string; ownerPhone?: string } {
  return {
    ...parsed,
    title: manual.title || parsed.title,
    price: manual.price || parsed.price,
    location: manual.location || parsed.location,
    roomCount: manual.roomCount || parsed.roomCount,
    area: manual.area || parsed.area,
    ownerName: manual.ownerName,
    ownerPhone: manual.ownerPhone,
  };
}

/**
 * WhatsApp wa.me linki oluşturur
 */
export function generateWhatsAppLink(phone: string, message: string): string {
  // Türk telefon numarasını düzenle
  let cleanPhone = phone.replace(/\D/g, '');
  
  // Başında 0 varsa kaldır ve 90 ekle
  if (cleanPhone.startsWith('0')) {
    cleanPhone = '90' + cleanPhone.substring(1);
  }
  // 90 ile başlamıyorsa ekle
  if (!cleanPhone.startsWith('90')) {
    cleanPhone = '90' + cleanPhone;
  }

  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone}?text=${encodedMessage}`;
}

/**
 * Toplu Tarama (Bulk Hunt) Simülasyonu
 * Arama sayfası URL'si verildiğinde 10-15 adet mock ilan üretir.
 */
export function parseSearchUrlBulk(searchUrl: string, count: number = 12): ParsedListing[] {
  if (!isValidSahibindenUrl(searchUrl)) {
    return [];
  }

  const mockLocations = ['Mahmutlar', 'Oba', 'Kestel', 'Avsallar', 'Alanya Merkez', 'Kargıcak'];
  const mockPrices = ['3.500.000 TL', '4.250.000 TL', '5.100.000 TL', '2.850.000 TL', '6.000.000 TL', '7.500.000 TL'];
  const mockRooms = ['1+1', '2+1', '3+1', '4+1 Dubleks', '2+1 Eşyalı'];
  const mockAreas = ['65', '85', '110', '140', '180'];
  const mockOwnerNames = ['Ahmet Yılmaz', 'Mehmet Kaya', 'Ayşe Demir', 'Fatma Şahin', 'Mustafa Çelik', 'Emre Can'];
  
  // Rastgele telefon numaraları (05xx ile başlayan)
  const generatePhone = () => {
    const prefixes = ['532', '533', '555', '542', '544', '505'];
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const num = Math.floor(1000000 + Math.random() * 9000000);
    return `0${prefix}${num}`;
  };

  const results: ParsedListing[] = [];

  for (let i = 0; i < count; i++) {
    const loc = mockLocations[Math.floor(Math.random() * mockLocations.length)];
    const room = mockRooms[Math.floor(Math.random() * mockRooms.length)];
    const price = mockPrices[Math.floor(Math.random() * mockPrices.length)];
    const area = mockAreas[Math.floor(Math.random() * mockAreas.length)];
    const ownerName = mockOwnerNames[Math.floor(Math.random() * mockOwnerNames.length)];
    const phone = generatePhone();
    const id = Math.floor(1000000000 + Math.random() * 900000000).toString();

    results.push({
      url: `https://www.sahibinden.com/ilan/emlak-konut-satilik-${loc.toLowerCase()}-da-deniz-manzarali-${room.replace('+', '-')}-daire-${id}/detay`,
      listingId: id,
      title: `${loc} bölgesinde Acil Satılık ${room} Fırsat Daire`,
      price,
      location: loc,
      roomCount: room,
      area,
      category: 'Satılık',
      isValid: true,
      ownerName, // TS will allow this if we cast or we can just return it. The interface doesn't have ownerName/ownerPhone, so let's use any or update interface.
      ownerPhone: phone
    } as ParsedListing & { ownerName: string, ownerPhone: string });
  }

  return results;
}
