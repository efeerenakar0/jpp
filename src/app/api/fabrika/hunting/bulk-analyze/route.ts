import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseSearchUrlBulk } from '@/lib/sahibinden-parser';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

export async function POST(req: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { url } = await req.json();

    if (!url) {
      return NextResponse.json({ error: 'Arama URL\'si gerekli' }, { status: 400 });
    }

    // 1. Simüle edilmiş 12 ilanı çek
    const parsedListings = parseSearchUrlBulk(url, 12);
    
    if (parsedListings.length === 0) {
      return NextResponse.json({ error: 'Geçersiz Sahibinden arama URL\'si' }, { status: 400 });
    }

    const createdListings = [];

    // 2. İlanları veritabanına kaydet
    for (const data of parsedListings) {
      const listing = await prisma.huntedListing.create({
        data: {
          companyAccountId: principal.account.id,
          sourceUrl: data.url,
          title: data.title,
          price: data.price,
          location: data.location,
          roomCount: data.roomCount,
          area: data.area,
          ownerName: data.ownerName,
          ownerPhone: data.ownerPhone,
          status: 'YELLOW',
          rawData: JSON.stringify(data),
        },
      });
      createdListings.push(listing);
    }

    return NextResponse.json({ 
      success: true, 
      count: createdListings.length,
      listings: createdListings 
    });

  } catch (error) {
    console.error('Error in bulk analyze:', error);
    return NextResponse.json({ error: 'İlanlar taranırken hata oluştu' }, { status: 500 });
  }
}
