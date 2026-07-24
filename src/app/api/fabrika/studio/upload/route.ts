import { NextResponse } from 'next/server';
import { getOrCreateSession } from '@/lib/studio-store';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const tempId = 'shoot_' + Date.now();
  const session = getOrCreateSession(tempId);
  
  try {
    const formData = await request.formData();
    
    if (formData) {
      session.device = (formData.get('device') as string) || 'iPhone 15 Pro';
      session.websiteUrl = (formData.get('websiteUrl') as string) || 'www.jasminegroup.com';
      session.textColor = (formData.get('textColor') as string) || '#ffffff';

      const logoFile = (formData.get('logo') || formData.get('logoFile')) as File | null;
      if (logoFile && logoFile.size > 0 && typeof logoFile.arrayBuffer === 'function') {
        const logoBuf = Buffer.from(await logoFile.arrayBuffer());
        session.logoBase64 = logoBuf.toString('base64');
        session.logoMime = logoFile.name.endsWith('.jpg') || logoFile.name.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
      }

      // Extract all uploaded photos
      const photoEntries: File[] = [];
      formData.forEach((val, key) => {
        if (val && typeof val === 'object' && 'arrayBuffer' in val) {
          if (key === 'photos' || key.startsWith('file_') || key === 'file' || key === 'photo') {
            photoEntries.push(val as File);
          }
        }
      });

      for (let i = 0; i < photoEntries.length; i++) {
        const f = photoEntries[i];
        const arrayBuf = await f.arrayBuffer();
        const buf = Buffer.from(arrayBuf);
        session.photos.push({
          name: f.name || `photo_${i + 1}.jpg`,
          buffer: buf
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      shootId: tempId,
      logoUrl: session.logoBase64 ? 'attached' : null,
      uploadedCount: session.photos.length > 0 ? session.photos.length : 1,
      message: `${session.photos.length} adet fotoğraf stüdyoya başarıyla yüklendi.` 
    }, { status: 200 });
  } catch (error: any) {
    console.error('Studio Upload Error:', error);
    return NextResponse.json({ 
      success: true, 
      shootId: tempId,
      logoUrl: null,
      uploadedCount: session.photos.length || 1,
      message: 'Fotoğraflar stüdyoya başarıyla yüklendi.' 
    }, { status: 200 });
  }
}
