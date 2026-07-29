import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

const listingSchema = z.object({
  listingId: z.string().trim().optional().nullable(),
  title: z.string().trim().min(2).max(300),
  url: z.string().trim().url().optional().nullable(),
  sourceUrl: z.string().trim().url().optional().nullable(),
  price: z.string().trim().max(100).optional().nullable(),
  location: z.string().trim().max(300).optional().nullable(),
  roomCount: z.string().trim().max(50).optional().nullable(),
  area: z.string().trim().max(100).optional().nullable(),
  ownerName: z.string().trim().max(200).optional().nullable(),
  imageUrl: z.string().trim().url().optional().nullable(),
}).strict();

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const payload = await request.json();
    const parsed = z.array(listingSchema).max(250).safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error:
            parsed.error.issues[0]?.message ||
            'Geçersiz ilan veri formatı.',
        },
        { status: 400 }
      );
    }
    let added = 0;
    let skipped = 0;
    for (const item of parsed.data) {
      const sourceUrl =
        item.url ||
        item.sourceUrl ||
        `https://manual.jasmine.local/${item.listingId || crypto.randomUUID()}`;
      const existing = await prisma.huntedListing.findFirst({
        where: {
          companyAccountId: principal.account.id,
          sourceUrl,
        },
        select: { id: true },
      });
      if (existing) {
        skipped += 1;
        continue;
      }
      await prisma.huntedListing.create({
        data: {
          companyAccountId: principal.account.id,
          sourceUrl,
          title: item.title,
          price: item.price || null,
          location: item.location || null,
          roomCount: item.roomCount || null,
          area: item.area || null,
          ownerName: item.ownerName || null,
          imageUrl: item.imageUrl || null,
          status: 'YELLOW',
          rawData: JSON.stringify(item),
        },
      });
      added += 1;
    }
    return NextResponse.json({ success: true, added, skipped });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { success: false, error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    console.error('JSON import error:', error);
    return NextResponse.json(
      { success: false, error: 'Yükleme sırasında hata oluştu.' },
      { status: 500 }
    );
  }
}
