import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { listingId, tone } = await req.json();

    if (!listingId || !tone) {
      return NextResponse.json({ error: 'Missing listingId or tone' }, { status: 400 });
    }

    const listing = await prisma.huntedListing.findUnique({
      where: { id: listingId },
    });

    if (!listing) {
      return NextResponse.json({ error: 'Listing not found' }, { status: 404 });
    }

    const company = await prisma.companyProfile.findFirst();
    if (!company) {
      return NextResponse.json({ error: 'Company profile not found' }, { status: 404 });
    }

    const promptText = PROMPTS.huntingMessage(
      { title: listing.title, price: listing.price || undefined, location: listing.location || undefined },
      { companyName: company.companyName, strengths: company.strengths, uniquePoints: company.uniquePoints },
      tone
    );

    const aiResponse = await callAI([{ role: 'user', content: promptText }], 'hunting');

    const message = await prisma.huntingMessage.create({
      data: {
        listingId: listing.id,
        content: aiResponse.content,
        tone: tone,
      },
    });

    return NextResponse.json(message);
  } catch (error) {
    console.error('Error generating message:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
