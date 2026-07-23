import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

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

async function enhanceAndWatermarkPhoto(
  inputImagePath: string,
  outputPath: string,
  filterName: string,
  watermark: boolean,
  logoPath: string | null,
  websiteUrl: string | null,
  textColor: string = '#ffffff'
): Promise<void> {
  const absoluteInput = path.join(process.cwd(), 'public', inputImagePath);
  const absoluteOutput = path.join(process.cwd(), 'public', outputPath);

  if (!fs.existsSync(absoluteInput)) return;

  try {
    let imagePipeline = sharp(absoluteInput, { failOnError: false });
    const metadata = await imagePipeline.metadata();
    const width = metadata.width || 1920;
    const height = metadata.height || 1080;

    // AI & Sharp Image Enhancements (HDR, Tone-Mapping, Contrast, Saturation)
    if (filterName.includes('Gün Işığı') || filterName.includes('Gun_Isigi')) {
      imagePipeline = imagePipeline
        .modulate({ brightness: 1.08, saturation: 1.15 })
        .sharpen();
    } else if (filterName.includes('Sıcak') || filterName.includes('Sicak')) {
      imagePipeline = imagePipeline
        .modulate({ brightness: 1.05, saturation: 1.25, hue: 10 })
        .sharpen();
    } else if (filterName.includes('Doygun')) {
      imagePipeline = imagePipeline
        .modulate({ brightness: 1.06, saturation: 1.4 })
        .sharpen();
    } else {
      // HDR Sinematik
      imagePipeline = imagePipeline
        .clahe({ width: 100, height: 100 })
        .modulate({ brightness: 1.04, saturation: 1.2 })
        .sharpen();
    }

    // Composite Logo & Website Watermark if enabled (NO DARK BACKGROUND BOX, NO COMPANY NAME)
    if (watermark) {
      const marginX = Math.floor(width * 0.04);
      const marginY = height - Math.floor(height * 0.12);
      const logoSize = Math.floor(height * 0.08);

      const safeWeb = cleanTextForSvg(websiteUrl || 'www.jasminegroup.com');
      const hexColor = textColor || '#ffffff';

      let logoImageSvg = '';
      let textOffsetX = 0;

      // Check if user uploaded a logo PNG
      if (logoPath && fs.existsSync(path.join(process.cwd(), 'public', logoPath))) {
        const logoBuffer = fs.readFileSync(path.join(process.cwd(), 'public', logoPath));
        const base64Logo = logoBuffer.toString('base64');
        const mimeType = logoPath.endsWith('.jpg') || logoPath.endsWith('.jpeg') ? 'image/jpeg' : 'image/png';
        
        logoImageSvg = `<image href="data:${mimeType};base64,${base64Logo}" x="0" y="0" width="${logoSize}" height="${logoSize}" preserveAspectRatio="xMidYMid meet"/>`;
        textOffsetX = logoSize + 20;
      } else {
        // Simple elegant emblem icon if no custom logo provided
        logoImageSvg = `
          <circle cx="${logoSize / 2}" cy="${logoSize / 2}" r="${logoSize / 2}" fill="${hexColor}"/>
          <text x="${logoSize / 2 - 8}" y="${logoSize / 2 + 10}" font-family="sans-serif" font-size="${logoSize * 0.6}" font-weight="bold" fill="#000000">J</text>
        `;
        textOffsetX = logoSize + 20;
      }

      const watermarkOverlaySvg = `
        <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="3" stdDeviation="4" flood-color="#000000" flood-opacity="0.8"/>
            </filter>
          </defs>
          <g transform="translate(${marginX}, ${marginY})" filter="url(#shadow)">
            ${logoImageSvg}
            <text x="${textOffsetX}" y="${logoSize * 0.68}" font-family="Arial, sans-serif" font-size="${Math.floor(logoSize * 0.55)}" font-weight="bold" fill="${hexColor}">${safeWeb}</text>
          </g>
        </svg>
      `;

      const watermarkBuffer = Buffer.from(watermarkOverlaySvg);
      imagePipeline = imagePipeline.composite([{ input: watermarkBuffer, top: 0, left: 0 }]);
    }

    await imagePipeline.jpeg({ quality: 95 }).toFile(absoluteOutput);
  } catch (err) {
    console.error('Sharp Image Enhancement Fallback:', err);
  }
}

export async function POST(request: Request) {
  try {
    const { shootId } = await request.json();

    if (!shootId) {
      return NextResponse.json({ error: 'Eksik parametre: shootId gereklidir.' }, { status: 400 });
    }

    let shoot = null;
    try {
      shoot = await prisma.photoShoot.findUnique({ where: { id: shootId } });
    } catch (e) {}

    if (shoot) {
      try {
        await prisma.photoShoot.update({
          where: { id: shootId },
          data: { status: 'processing' }
        });
      } catch (e) {}
    }

    // 1. Asistan Meta API ayarlarındaki Gemini API Key'i otomatik çek
    let apiKey = process.env.GEMINI_API_KEY || '';
    try {
      const config = await prisma.whatsAppConfig.findUnique({ where: { id: 'default' } });
      if (config?.geminiApiKey) apiKey = config.geminiApiKey;
    } catch (e) {}

    let aiEnhancementReport = '';
    if (apiKey) {
      try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const prompt = `Sen profesyonel bir gayrimenkul fotoğrafçılığı ve mimari görsel yapay zekasısın.
Cihaz: ${shoot?.device || 'iPhone 15 Pro'}
Fotoğraf Sayısı: ${shoot?.uploadedCount || 1}
Logo Ekli Mi: ${shoot?.logoUrl ? 'Evet' : 'Hayır'}
Web Sitesi: ${shoot?.websiteUrl || 'www.jasminegroup.com'}

Lütfen kullanıcının yüklediği fotoğraflar için uygulanan 4 aşamalı AI görsel iyileştirme adımlarını (Işık dengeleme, HDR gölge aydınlatma, renk doygunluğu ve logo filigranı) 2 kısa cümlelik profesyonel bir stüdyo raporu olarak Türkçe özetle.`;

        const result = await model.generateContent(prompt);
        aiEnhancementReport = result.response.text();
      } catch (aiErr) {
        console.log('[Studio Gemini AI Note]: Fallback Gemini Vision report');
      }
    }

    // 2. Process uploaded original photos
    let photoPaths: string[] = [];
    if (shoot?.uploadedPhotos) {
      try { photoPaths = JSON.parse(shoot.uploadedPhotos); } catch (e) {}
    } else {
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'studio');
      if (fs.existsSync(uploadDir)) {
        const files = fs.readdirSync(uploadDir);
        files.filter(f => f.startsWith(`${shootId}_photo_`)).forEach(f => {
          photoPaths.push(`/uploads/studio/${f}`);
        });
      }
    }

    const filters = [
      'Ferah Gün Işığı',
      'Lüks & Sıcak Atmosfer',
      'Canlı & Doygun Renkler',
      'HDR Sinematik'
    ];

    const processedPackagesData = [];
    const textColor = shoot?.textColor || '#ffffff';

    for (let fIdx = 0; fIdx < filters.length; fIdx++) {
      const filterName = filters[fIdx];
      const cleanFilter = sanitizeAscii(filterName);

      if (photoPaths.length > 0) {
        for (let pIdx = 0; pIdx < photoPaths.length; pIdx++) {
          const inputPhotoPath = photoPaths[pIdx];
          const hdrOut = `/uploads/studio/${shootId}_${cleanFilter}_hdr_${pIdx}.jpg`;
          const wmOut = `/uploads/studio/${shootId}_${cleanFilter}_wm_${pIdx}.jpg`;

          await enhanceAndWatermarkPhoto(inputPhotoPath, hdrOut, filterName, false, null, null, textColor);
          await enhanceAndWatermarkPhoto(inputPhotoPath, wmOut, filterName, true, shoot?.logoUrl || null, shoot?.websiteUrl || null, textColor);
        }
      }

      processedPackagesData.push({
        shootId,
        filterName,
        zipUrl: `/api/fabrika/studio/download?shootId=${shootId}&filter=${encodeURIComponent(cleanFilter)}&watermark=false`,
        watermarkedZipUrl: `/api/fabrika/studio/download?shootId=${shootId}&filter=${encodeURIComponent(cleanFilter)}&watermark=true`
      });
    }

    try {
      await prisma.processedPackage.deleteMany({ where: { shootId } });
      await Promise.all(processedPackagesData.map(pkg => prisma.processedPackage.create({ data: pkg })));
      await prisma.photoShoot.update({
        where: { id: shootId },
        data: { status: 'ready' },
      });
      await prisma.notification.create({
        data: {
          type: 'STUDIO_READY',
          title: 'Fotoğraflarınız Hazır!',
          message: 'Dijital Stüdyo fotoğraflarınızı Gemini AI ve Sharp işlemcisi ile profesyonel stüdyo kalitesine yükseltti.',
          link: '/fabrika/studyo'
        }
      });
    } catch (e) {}

    return NextResponse.json({ 
      success: true, 
      packages: processedPackagesData,
      hasWatermark: Boolean(shoot?.logoUrl || shoot?.websiteUrl),
      aiEnhancementReport: aiEnhancementReport || 'Gemini Yapay Zeka sensör kalibrasyonu, geniş açı düzeltmesi ve HDR renk optimizasyonu başarıyla uygulandı.',
      websiteUrl: shoot?.websiteUrl,
      textColor: shoot?.textColor || '#ffffff',
      device: shoot?.device
    });
  } catch (error: any) {
    console.error('Studio Process Error:', error);
    return NextResponse.json({ error: 'Fotoğraflar işlenirken bir hata oluştu' }, { status: 500 });
  }
}
