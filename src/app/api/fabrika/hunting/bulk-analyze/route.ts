import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseSearchUrlBulk } from '@/lib/sahibinden-parser';

export async function POST(req: Request) {
  try {
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
      const listingData = data as any; // Cast to access ownerName and ownerPhone
      const listing = await prisma.huntedListing.create({
        data: {
          sourceUrl: listingData.url,
          title: listingData.title,
          price: listingData.price,
          location: listingData.location,
          roomCount: listingData.roomCount,
          area: listingData.area,
          ownerName: listingData.ownerName,
          ownerPhone: listingData.ownerPhone,
          status: 'YELLOW',
          rawData: JSON.stringify(listingData),
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
