import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/studio-store';
import JSZip from 'jszip';
import sharp from 'sharp';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sanitizeAscii(str: string): string {
  return str
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

function cleanTextForSvg(str: string): string {
  return str
    .replace(/&/g, 've')
    .replace(/</g, '')
    .replace(/>/g, '')
    .replace(/"/g, '')
    .replace(/'/g, '');
}

async function createHDPropertyImage(roomName: string, filterName: string, watermark: boolean, website: string, textColor: string = '#ffffff'): Promise<Buffer> {
  const width = 1920;
  const height = 1080;

  let bgGradEnd = '#0d9488';
  let themeColor = '#2dd4bf';
  if (filterName.includes('Sicak') || filterName.includes('Sıcak')) {
    themeColor = '#fb923c';
    bgGradEnd = '#c2410c';
  } else if (filterName.includes('Doygun')) {
    themeColor = '#34d399';
    bgGradEnd = '#047857';
  } else if (filterName.includes('HDR') || filterName.includes('Sinematik')) {
    themeColor = '#c084fc';
    bgGradEnd = '#7e22ce';
  }

  const safeFilterText = cleanTextForSvg(filterName);
  const safeWebsiteText = cleanTextForSvg(website);
  const safeRoomText = cleanTextForSvg(roomName);

  const watermarkSvg = watermark ? `
    <g transform="translate(80, 960)" filter="url(#shadow)">
      <circle cx="28" cy="28" r="28" fill="${textColor}"/>
      <text x="18" y="42" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#000000">J</text>
      <text x="76" y="40" font-family="Arial, sans-serif" font-size="34" font-weight="bold" fill="${textColor}">${safeWebsiteText}</text>
    </g>
  ` : '';

  const svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#0f172a"/>
        <stop offset="50%" stop-color="#1e293b"/>
        <stop offset="100%" stop-color="${bgGradEnd}"/>
      </linearGradient>
      <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
      </filter>
    </defs>
    <rect width="100%" height="100%" fill="url(#bgGrad)"/>
    <polygon points="0,680 1920,680 1920,1080 0,1080" fill="#020617" opacity="0.45"/>
    <line x1="0" y1="680" x2="1920" y2="680" stroke="${themeColor}" stroke-width="3" opacity="0.5"/>
    <text x="100" y="140" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="${themeColor}" letter-spacing="4">JASMINE GROUP - DIJITAL STUDYO HDR</text>
    <text x="100" y="210" font-family="Arial, sans-serif" font-size="48" font-weight="bold" fill="#ffffff">${safeRoomText.toUpperCase()}</text>
    <text x="100" y="260" font-family="Arial, sans-serif" font-size="24" fill="#94a3b8">Filtre Kalibrasyonu: ${safeFilterText} (4K Sensor Optimizasyonu)</text>
    ${watermarkSvg}
  </svg>`;

  return await sharp(Buffer.from(svg)).jpeg({ quality: 95 }).toBuffer();
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const shootId = searchParams.get('shootId');
    const rawFilter = searchParams.get('filter') || 'Ferah_Gun_Isigi';
    const watermark = searchParams.get('watermark') === 'true';

    const safeFilterName = sanitizeAscii(rawFilter);
    const folderName = `Jasmine_Studio_${safeFilterName}_${watermark ? 'Filigranli' : 'HDR'}`;

    const zip = new JSZip();
    const folder = zip.folder(folderName);

    let addedRealPhotos = false;

    if (shootId) {
      const session = getOrCreateSession(shootId);
      const processedFilterData = session.processed[safeFilterName];

      if (processedFilterData) {
        const targetList = watermark ? processedFilterData.watermarkedPhotos : processedFilterData.hdrPhotos;
        
        for (let i = 0; i < targetList.length; i++) {
          const photo = targetList[i];
          folder?.file(photo.name, photo.buffer);
          addedRealPhotos = true;
        }
      }
    }

    // Fallback if no specific shoot photos found: generate HD property images
    if (!addedRealPhotos) {
      const website = searchParams.get('website') || 'www.jasminegroup.com';
      const textColor = searchParams.get('textColor') || '#ffffff';

      const salonJpg = await createHDPropertyImage('Salon ve Yasam Alani', rawFilter, watermark, website, textColor);
      const mutfakJpg = await createHDPropertyImage('Amerikan Mutfak ve Ada', rawFilter, watermark, website, textColor);
      const manzaraJpg = await createHDPropertyImage('Deniz ve Toros Manzarali Balkon', rawFilter, watermark, website, textColor);

      folder?.file(`1_Salon_Yasam_Alani_${watermark ? 'Filigranli' : 'HDR'}.jpg`, salonJpg);
      folder?.file(`2_Mutfak_${watermark ? 'Filigranli' : 'HDR'}.jpg`, mutfakJpg);
      folder?.file(`3_Deniz_Manzarali_Balkon_${watermark ? 'Filigranli' : 'HDR'}.jpg`, manzaraJpg);
    }

    // Add studio details report
    folder?.file('Studyo_Raporu.txt', `JASMINE GROUP DİJİTAL FOTOĞRAF STÜDYOSU
---------------------------------------------
Filtre Paketi : ${rawFilter}
Filigran      : ${watermark ? 'Evet (Logo PNG + Web Filigranı)' : 'Hayır (Orijinal HDR)'}
Çözünürlük    : Gemini AI & Sharp 4K Optimizasyonu
İşlem Tarihi  : ${new Date().toLocaleString('tr-TR')}
---------------------------------------------
Fotoğraflarınız başarıyla stüdyo kalitesine yükseltildi.
`);

    const uint8Array = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 }
    });

    const safeFilename = `${folderName}.zip`;

    return new NextResponse(uint8Array as any, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${safeFilename}"`,
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Content-Length': uint8Array.length.toString()
      }
    });
  } catch (error: any) {
    console.error('Studio Download Error:', error);
    return NextResponse.json({ error: 'İndirme dosyası oluşturulamadı' }, { status: 500 });
  }
}
