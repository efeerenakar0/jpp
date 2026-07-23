import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const campaigns = await prisma.adCampaign.findMany({
      include: {
        adCopies: {
          include: {
            listing: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json(campaigns);
  } catch (error) {
    console.error('Error fetching campaigns:', error);
    return NextResponse.json({ error: 'Failed to fetch campaigns' }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { adCopyId, approved } = await req.json();

    if (!adCopyId || typeof approved !== 'boolean') {
      return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
    }

    const copy = await prisma.adCopy.update({
      where: { id: adCopyId },
      data: { approved }
    });

    return NextResponse.json(copy);
  } catch (error) {
    console.error('Error updating ad copy:', error);
    return NextResponse.json({ error: 'Failed to update ad copy' }, { status: 500 });
  }
}
