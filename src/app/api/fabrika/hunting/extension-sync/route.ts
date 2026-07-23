import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// CORS Middleware (Extension'dan gelen istekleri engellememek için)
export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

export async function POST(req: Request) {
  try {
    const data = await req.json();

    if (!data.url || !data.title) {
      return NextResponse.json({ error: 'Eksik veri (url veya title)' }, { 
        status: 400,
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // İlan zaten var mı kontrol et
    const existing = data.listingId 
      ? await prisma.huntedListing.findFirst({ where: { sourceUrl: { contains: data.listingId } } })
      : await prisma.huntedListing.findFirst({ where: { sourceUrl: data.url } });

    if (existing) {
      return NextResponse.json({ success: true, message: 'Bu ilan zaten avlanmış', listing: existing }, { 
        headers: { 'Access-Control-Allow-Origin': '*' }
      });
    }

    // Yeni ilanı kaydet
    const listing = await prisma.huntedListing.create({
      data: {
        sourceUrl: data.url,
        title: data.title,
        price: data.price || null,
        location: data.location || null,
        roomCount: data.roomCount || null,
        area: data.area || null,
        ownerName: data.ownerName || null,
        ownerPhone: data.ownerPhone || null,
        status: 'YELLOW', // Direkt panoya sarı olarak düşer
        rawData: JSON.stringify(data),
      },
    });

    return NextResponse.json({ success: true, listing }, {
      headers: { 'Access-Control-Allow-Origin': '*' }
    });

  } catch (error) {
    console.error('Error syncing extension data:', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { 
      status: 500,
      headers: { 'Access-Control-Allow-Origin': '*' }
    });
  }
}
