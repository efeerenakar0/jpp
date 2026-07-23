import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function PATCH(req: Request) {
  try {
    const { id, status } = await req.json();

    if (!id || !status) {
      return NextResponse.json({ error: 'Missing id or status' }, { status: 400 });
    }

    const listing = await prisma.huntedListing.update({
      where: { id },
      data: { status },
    });

    if (status === 'GREEN') {
      await prisma.notification.create({
        data: {
          type: 'GREEN_LISTING',
          title: 'Yeni İlan Avlandı!',
          message: `${listing.title} başarıyla portföye eklendi.`,
          link: `/fabrika/avci`,
        },
      });
    }

    return NextResponse.json(listing);
  } catch (error) {
    console.error('Error updating status:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
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
    return NextResponse.json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
