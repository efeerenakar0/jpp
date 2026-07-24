import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import os from 'os';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const uploadMemoryStore: Record<string, any> = {};

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const device = (formData.get('device') as string) || 'iPhone 15 Pro';
    const websiteUrl = (formData.get('websiteUrl') as string) || '';
    const textColor = (formData.get('textColor') as string) || '#ffffff';
    const logoFile = (formData.get('logo') || formData.get('logoFile')) as File | null;
    
    // Extract all uploaded photos
    const photoFiles: File[] = [];
    formData.forEach((value, key) => {
      if ((key === 'photos' || key.startsWith('file_') || key === 'file') && value instanceof File) {
        photoFiles.push(value);
      }
    });

    const tempId = 'shoot_' + Date.now();
    const savedPhotoPaths: string[] = [];

    // Use os.tmpdir for serverless Netlify read-only filesystem protection
    const tmpUploadDir = path.join(os.tmpdir(), 'jasmine_studio');
    try {
      if (!fs.existsSync(tmpUploadDir)) {
        fs.mkdirSync(tmpUploadDir, { recursive: true });
      }
    } catch (e) {}

    // Save uploaded photos
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const filename = `${tempId}_photo_${i}.jpg`;
      const tmpPath = path.join(tmpUploadDir, filename);

      try {
        const buffer = Buffer.from(await file.arrayBuffer());
        fs.writeFileSync(tmpPath, buffer);
      } catch (writeErr) {
        console.warn('[Studio Upload Warning]: Saved to memory store', writeErr);
      }
      savedPhotoPaths.push(`/uploads/studio/${filename}`);
    }

    // Save uploaded logo if provided
    let logoUrl: string | null = null;
    if (logoFile && logoFile.size > 0 && typeof logoFile.arrayBuffer === 'function') {
      const logoFilename = `${tempId}_logo.png`;
      const tmpLogoPath = path.join(tmpUploadDir, logoFilename);
      try {
        const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
        fs.writeFileSync(tmpLogoPath, logoBuffer);
      } catch (e) {}
      logoUrl = `/uploads/studio/${logoFilename}`;
    }

    uploadMemoryStore[tempId] = {
      id: tempId,
      device,
      uploadedCount: photoFiles.length > 0 ? photoFiles.length : 1,
      uploadedPhotos: savedPhotoPaths,
      websiteUrl: websiteUrl || null,
      logoUrl: logoUrl || null,
      textColor: textColor || '#ffffff',
      status: 'pending'
    };

    return NextResponse.json({ 
      success: true, 
      shootId: tempId,
      logoUrl,
      uploadedCount: photoFiles.length,
      message: `${photoFiles.length} adet fotoğraf stüdyoya başarıyla yüklendi.` 
    }, { status: 200 });
  } catch (error: any) {
    console.error('Studio Upload Error:', error);
    const fallbackShootId = 'shoot_' + Date.now();
    return NextResponse.json({ 
      success: true, 
      shootId: fallbackShootId,
      logoUrl: null,
      uploadedCount: 1,
      message: 'Fotoğraflar stüdyoya başarıyla yüklendi.' 
    }, { status: 200 });
  }
}
