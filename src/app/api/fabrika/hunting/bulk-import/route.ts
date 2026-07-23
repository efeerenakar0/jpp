import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const listings = await req.json();

    if (!listings || !Array.isArray(listings)) {
      return NextResponse.json({ error: 'Geçersiz veri formatı. Bir dizi (array) bekleniyor.' }, { status: 400 });
    }

    let successCount = 0;
    
    for (const data of listings) {
      if (!data.listingId || !data.title || !data.url) continue;

      const existing = await prisma.huntedListing.findFirst({
        where: { sourceUrl: data.url }
      });

      if (!existing) {
        await prisma.huntedListing.create({
          data: {
            title: data.title,
            price: data.price,
            location: data.location,
            roomCount: data.roomCount,
            area: data.area,
            ownerName: data.ownerName,
            ownerPhone: data.ownerPhone,
            sourceUrl: data.url,
            status: 'YELLOW'
          }
        });
        successCount++;
      }
    }

    return NextResponse.json({ success: true, added: successCount });
  } catch (error) {
    console.error('JSON Import Error:', error);
    return NextResponse.json({ error: 'Yükleme sırasında hata oluştu' }, { status: 500 });
  }
}
