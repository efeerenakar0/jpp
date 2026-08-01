import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/studio-store';
import JSZip from 'jszip';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    await requireFabrikaPrincipal();
    const searchParams = new URL(request.url).searchParams;
    const shootId = searchParams.get('shootId');
    const format = searchParams.get('format');
    const imageIndex = Number(searchParams.get('index'));
    const asDownload = searchParams.get('download') === 'true';

    if (!shootId || !format) {
      return NextResponse.json({ error: 'Çekim ID’si ve indirme biçimi gerekli.' }, { status: 400 });
    }

    const session = getOrCreateSession(shootId);
    const photos = session.aiPhotos;
    if (!photos.length) {
      return NextResponse.json({ error: 'İndirilecek işlenmiş fotoğraf bulunamadı.' }, { status: 404 });
    }

    if (format === 'single') {
      const photo = photos[imageIndex];
      if (!photo) {
        return NextResponse.json({ error: 'İstenen görsel bulunamadı.' }, { status: 404 });
      }
      return new NextResponse(new Uint8Array(photo.buffer), {
        headers: {
          'Content-Type': photo.mimeType,
          'Content-Disposition': `${asDownload ? 'attachment' : 'inline'}; filename="${photo.name}"`,
          'Cache-Control': 'no-store',
        },
      });
    }

    if (format !== 'zip') {
      return NextResponse.json({ error: 'Geçersiz indirme biçimi.' }, { status: 400 });
    }

    const folderName = 'Business_CEO_AI_Studio_Iyilestirilmis';
    const zip = new JSZip();
    const folder = zip.folder(folderName);
    for (const photo of photos) {
      folder?.file(photo.name, photo.buffer);
    }
    folder?.file(
      'Studyo_Raporu.txt',
`BUSINESS CEO AI DİJİTAL FOTOĞRAF STÜDYOSU
İşlem Motoru  : ${session.aiProvider === 'STABILITY' ? 'Stability AI' : session.aiProvider === 'GEMINI' ? 'Google Gemini' : 'OpenAI GPT Image'}
Model          : ${session.aiModel || 'Varsayılan model'}
İşlem          : Portföy görselleri için ışık, renk, netlik ve genel kalite iyileştirmesi
İşlem Tarihi  : ${new Date().toLocaleString('tr-TR')}
`
    );

    const archive = await zip.generateAsync({
      type: 'uint8array',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });
    return new NextResponse(archive.buffer.slice(archive.byteOffset, archive.byteOffset + archive.byteLength) as ArrayBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${folderName}.zip"`,
        'Cache-Control': 'no-store',
        'Content-Length': archive.length.toString(),
      },
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    console.error('[Studio Download Error]:', error);
    return NextResponse.json({ error: 'İndirme dosyası oluşturulamadı.' }, { status: 500 });
  }
}
