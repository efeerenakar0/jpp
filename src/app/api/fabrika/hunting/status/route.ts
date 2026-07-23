import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

let inMemoryHuntedListings = [
  {
    id: 'hunted_1',
    sourceUrl: 'https://www.sahibinden.com/ilan/emlak-konut-satilik-mahmutlar-denize-sifir-luks-2-plus-1-daire-1029384/detay',
    title: 'Mahmutlar Denize Sıfır Lüks 2+1 Mobilyalı Daire',
    price: '€135.000',
    location: 'Alanya / Mahmutlar',
    roomCount: '2+1',
    area: '110 m²',
    ownerName: 'Mustafa Bey (Mal Sahibi)',
    ownerPhone: '905551112233',
    status: 'YELLOW',
    whatsappStatus: 'BEKLIYOR',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    messages: []
  },
  {
    id: 'hunted_2',
    sourceUrl: 'https://www.sahibinden.com/ilan/emlak-konut-satilik-kargicak-ozel-havuzlu-3-plus-1-villa-987654/detay',
    title: 'Kargıcak Özel Havuzlu Panorama Deniz Manzaralı Villa',
    price: '€390.000',
    location: 'Alanya / Kargıcak',
    roomCount: '3+1',
    area: '240 m²',
    ownerName: 'Elena V. (Ev Sahibi)',
    ownerPhone: '905554445566',
    status: 'GREEN',
    whatsappStatus: 'CEVAPLANDI',
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    messages: []
  }
];

export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    inMemoryHuntedListings = inMemoryHuntedListings.map(l => l.id === id ? { ...l, status } : l);

    try {
      const listing = await prisma.huntedListing.update({
        where: { id },
        data: { status },
      });
      return NextResponse.json(listing);
    } catch (e) {
      const updated = inMemoryHuntedListings.find(l => l.id === id) || { id, status };
      return NextResponse.json(updated);
    }
  } catch (error) {
    return NextResponse.json({ success: true });
  }
}

export async function GET() {
  try {
    const listings = await prisma.huntedListing.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        }
      }
    });
    if (listings && listings.length > 0) {
      return NextResponse.json(listings);
    }
    return NextResponse.json(inMemoryHuntedListings);
  } catch (error) {
    console.warn('[Hunting Status GET DB Warning]: Using sample listings fallback', error);
    return NextResponse.json(inMemoryHuntedListings);
  }
}
