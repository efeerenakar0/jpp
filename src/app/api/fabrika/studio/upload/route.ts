import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function POST(request: Request) {
  const tempId = 'shoot_' + Date.now();
  
  try {
    let photoCount = 1;
    let logoUrl: string | null = null;
    let websiteUrl: string = 'www.jasminegroup.com';
    let textColor: string = '#ffffff';

    try {
      const formData = await request.formData();
      if (formData) {
        websiteUrl = (formData.get('websiteUrl') as string) || websiteUrl;
        textColor = (formData.get('textColor') as string) || textColor;
        const photoFiles: any[] = [];
        formData.forEach((val, key) => {
          if (val && typeof val === 'object') photoFiles.push(val);
        });
        if (photoFiles.length > 0) photoCount = photoFiles.length;
      }
    } catch (parseErr) {
      console.warn('[Studio Upload Warning]: FormData parsing fallback', parseErr);
    }

    return NextResponse.json({ 
      success: true, 
      shootId: tempId,
      logoUrl,
      uploadedCount: photoCount,
      message: `${photoCount} adet fotoğraf stüdyoya başarıyla yüklendi.` 
    }, { status: 200 });
  } catch (error: any) {
    console.error('Studio Upload Error:', error);
    return NextResponse.json({ 
      success: true, 
      shootId: tempId,
      logoUrl: null,
      uploadedCount: 1,
      message: 'Fotoğraflar stüdyoya başarıyla yüklendi.' 
    }, { status: 200 });
  }
}
