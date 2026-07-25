import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/studio-store';
import JSZip from 'jszip';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function sanitizeAscii(value: string): string {
  return value
    .replace(/ğ/g, 'g').replace(/Ğ/g, 'G')
    .replace(/ü/g, 'u').replace(/Ü/g, 'U')
    .replace(/ş/g, 's').replace(/Ş/g, 'S')
    .replace(/ı/g, 'i').replace(/İ/g, 'I')
    .replace(/ö/g, 'o').replace(/Ö/g, 'O')
    .replace(/ç/g, 'c').replace(/Ç/g, 'C')
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_');
}

export async function GET(request: Request) {
  try {
    const searchParams = new URL(request.url).searchParams;
    const shootId = searchParams.get('shootId');
    const rawFilter = searchParams.get('filter');
    const watermark = searchParams.get('watermark') === 'true';

    if (!shootId || !rawFilter) {
      return NextResponse.json(
        { error: 'Çekim ID’si ve filtre gerekli.' },
        { status: 400 }
      );
    }

    const safeFilterName = sanitizeAscii(rawFilter);
    const session = getOrCreateSession(shootId);
    const processed = session.processed[safeFilterName];
    const photos = watermark
      ? processed?.watermarkedPhotos
      : processed?.hdrPhotos;

    if (!photos?.length) {
      return NextResponse.json(
        { error: 'İndirilecek işlenmiş fotoğraf bulunamadı.' },
        { status: 404 }
      );
    }

    const folderName = `Jasmine_Studio_${safeFilterName}_${watermark ? 'Filigranli' : 'Islenmis'}`;
    const zip = new JSZip();
    const folder = zip.folder(folderName);

    for (const photo of photos) {
      folder?.file(photo.name, photo.buffer);
    }

    folder?.file(
      'Studyo_Raporu.txt',
      `JASMINE GROUP DİJİTAL FOTOĞRAF STÜDYOSU
Filtre Paketi : ${rawFilter}
Filigran      : ${watermark ? 'Evet' : 'Hayır'}
İşlem Motoru  : Sharp ışık, renk ve keskinlik düzenleme
İşlem Tarihi  : ${new Date().toLocaleString('tr-TR')}
`
    );

    const archive = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    const responseBody = archive.buffer.slice(
      archive.byteOffset,
      archive.byteOffset + archive.byteLength
    ) as ArrayBuffer;

    return new NextResponse(responseBody, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
        'Cache-Control': 'no-store',
        'Content-Length': archive.length.toString(),
      },
    });
  } catch (error) {
    console.error('[Studio Download Error]:', error);
    return NextResponse.json(
      { error: 'İndirme dosyası oluşturulamadı.' },
      { status: 500 }
    );
  }
}
