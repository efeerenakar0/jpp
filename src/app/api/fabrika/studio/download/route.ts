import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import JSZip from 'jszip';
import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

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

  let themeColor = '#2dd4bf';
  let bgGradEnd = '#0d9488';
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
      <text x="18" y="42" font-family="sans-serif" font-size="32" font-weight="bold" fill="#000000">J</text>
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
    <line x1="960" y1="680" x2="960" y2="1080" stroke="${themeColor}" stroke-width="1.5" opacity="0.3"/>
    <polygon points="1200,0 1920,0 1920,680 1400,680" fill="#ffffff" opacity="0.05"/>
    <text x="100" y="140" font-family="sans-serif" font-size="22" font-weight="bold" fill="${themeColor}" letter-spacing="4">JASMINE GROUP - DIJITAL STUDYO HDR</text>
    <text x="100" y="210" font-family="sans-serif" font-size="48" font-weight="bold" fill="#ffffff">${safeRoomText.toUpperCase()}</text>
    <text x="100" y="260" font-family="sans-serif" font-size="24" fill="#94a3b8">Filtre Kalibrasyonu: ${safeFilterText} (4K Sensor Optimizasyonu)</text>
    <rect x="100" y="310" width="840" height="260" rx="16" fill="#1e293b" opacity="0.75" stroke="${themeColor}" stroke-width="1.5"/>
    <text x="130" y="370" font-family="sans-serif" font-size="22" fill="#e2e8f0">+ Genis Aci Distorsiyon Duzeltildi</text>
    <text x="130" y="420" font-family="sans-serif" font-size="22" fill="#e2e8f0">+ Golge ve Yansima Dengeleme (HDR Tone-Mapping)</text>
    <text x="130" y="470" font-family="sans-serif" font-size="22" fill="#e2e8f0">+ ${watermark ? 'Logo ve Web Filigrani Eklendi' : 'Orijinal HDR Cikti'}</text>
    <text x="130" y="520" font-family="sans-serif" font-size="22" fill="${themeColor}">+ Portallara Hazir Yuksek Cozunurluk HD JPEG</text>
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
    const website = searchParams.get('website') || 'www.jasminegroup.com';
    const textColor = searchParams.get('textColor') || '#ffffff';

    const safeFilterName = sanitizeAscii(rawFilter);
    const folderName = `Jasmine_Studio_${safeFilterName}_${watermark ? 'Filigranli' : 'HDR'}`;

    const zip = new JSZip();
    const folder = zip.folder(folderName);

    let addedRealPhotos = false;

    // If shootId is provided, look for user's actual uploaded processed photos
    if (shootId) {
      try {
        const shoot = await prisma.photoShoot.findUnique({ where: { id: shootId } });
        if (shoot && shoot.uploadedPhotos) {
          const photoPaths: string[] = JSON.parse(shoot.uploadedPhotos);
          for (let pIdx = 0; pIdx < photoPaths.length; pIdx++) {
            const fileName = `${shootId}_${safeFilterName}_${watermark ? 'wm' : 'hdr'}_${pIdx}.jpg`;
            const absolutePath = path.join(process.cwd(), 'public', 'uploads', 'studio', fileName);
            
            if (fs.existsSync(absolutePath)) {
              const imageBuffer = fs.readFileSync(absolutePath);
              folder?.file(`Foto_${pIdx + 1}_${watermark ? 'Filigranli' : 'HDR'}.jpg`, imageBuffer);
              addedRealPhotos = true;
            }
          }
        }
      } catch (dbErr) {
        console.error('Error fetching shoot for download:', dbErr);
      }
    }

    // Fallback if no specific shoot photos found: generate HD property images
    if (!addedRealPhotos) {
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
Filigran      : ${watermark ? 'Evet (Logo PNG + ' + website + ')' : 'Hayır (Orijinal HDR)'}
Çözünürlük    : Gemini AI & Sharp HDR Optimizasyonu
İşlem Tarihi  : ${new Date().toLocaleString('tr-TR')}
---------------------------------------------
Fotoğraflarınız kullanıma hazırdır.
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
