import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { parseListingUrl, mergeWithManualData } from '@/lib/sahibinden-parser';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

export async function POST(req: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const body = await req.json();
    const { url, ...manualData } = body;

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    const parsed = parseListingUrl(url);
    if (!parsed.isValid) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const finalData = mergeWithManualData(parsed, manualData);

    const listing = await prisma.huntedListing.create({
      data: {
        companyAccountId: principal.account.id,
        sourceUrl: finalData.url,
        title: finalData.title,
        price: finalData.price,
        location: finalData.location,
        roomCount: finalData.roomCount,
        area: finalData.area,
        ownerName: finalData.ownerName,
        ownerPhone: finalData.ownerPhone,
        status: 'YELLOW',
        rawData: JSON.stringify(finalData),
      },
    });

    return NextResponse.json(listing);
  } catch (error) {
    console.error('Error analyzing listing:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
