import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import fs from 'fs';
import path from 'path';

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

    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'studio');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const tempId = 'shoot_' + Date.now();
    const savedPhotoPaths: string[] = [];

    // Save uploaded photos to disk
    for (let i = 0; i < photoFiles.length; i++) {
      const file = photoFiles[i];
      const buffer = Buffer.from(await file.arrayBuffer());
      const ext = file.name.endsWith('.png') ? '.png' : '.jpg';
      const filename = `${tempId}_photo_${i}${ext}`;
      const filePath = path.join(uploadDir, filename);
      fs.writeFileSync(filePath, buffer);
      savedPhotoPaths.push(`/uploads/studio/${filename}`);
    }

    // Save uploaded logo if provided
    let logoUrl: string | null = null;
    if (logoFile && logoFile.size > 0 && typeof logoFile.arrayBuffer === 'function') {
      const logoBuffer = Buffer.from(await logoFile.arrayBuffer());
      const ext = logoFile.name.endsWith('.jpg') || logoFile.name.endsWith('.jpeg') ? '.jpg' : '.png';
      const logoFilename = `${tempId}_logo${ext}`;
      const logoPath = path.join(uploadDir, logoFilename);
      fs.writeFileSync(logoPath, logoBuffer);
      logoUrl = `/uploads/studio/${logoFilename}`;
    }

    let shootId = tempId;

    // Save shoot record to Prisma database
    try {
      const shoot = await prisma.photoShoot.create({
        data: {
          id: tempId,
          device,
          uploadedCount: photoFiles.length > 0 ? photoFiles.length : 1,
          uploadedPhotos: JSON.stringify(savedPhotoPaths),
          websiteUrl: websiteUrl || null,
          logoUrl: logoUrl || null,
          textColor: textColor || '#ffffff',
          status: 'pending',
        },
      });
      shootId = shoot.id;
    } catch (dbErr) {
      console.log('[Studio Upload Note]: Session stored locally as', tempId);
    }

    return NextResponse.json({ 
      success: true, 
      shootId,
      logoUrl,
      uploadedCount: photoFiles.length,
      message: `${photoFiles.length} adet fotoğraf stüdyoya başarıyla yüklendi.` 
    });
  } catch (error: any) {
    console.error('Studio Upload Error:', error);
    return NextResponse.json({ error: 'Fotoğraflar sunucuya yüklenirken bir hata oluştu' }, { status: 500 });
  }
}
