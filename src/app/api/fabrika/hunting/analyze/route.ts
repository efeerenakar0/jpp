import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { parseListingUrl, mergeWithManualData } from '@/lib/sahibinden-parser';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

const bodySchema = z
  .object({
    url: z.string().url().max(3000),
    title: z.string().trim().min(2).max(300).optional(),
    price: z.string().trim().max(100).optional(),
    location: z.string().trim().max(300).optional(),
    roomCount: z.string().trim().max(50).optional(),
    area: z.string().trim().max(100).optional(),
    ownerName: z.string().trim().max(200).optional(),
  })
  .strict();

export async function POST(req: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const body = bodySchema.parse(await req.json());
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
