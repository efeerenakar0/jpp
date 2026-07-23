import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS } from '@/lib/ai';

export async function POST(req: Request) {
  try {
    const { listingIds, tone = 'samimi' } = await req.json();

    if (!listingIds || !Array.isArray(listingIds) || listingIds.length === 0) {
      return NextResponse.json({ error: 'İlan ID listesi gerekli' }, { status: 400 });
    }

    const companyProfile = await prisma.companyProfile.findFirst();
    if (!companyProfile) {
      return NextResponse.json({ error: 'Önce şirket profilini doldurmalısınız' }, { status: 400 });
    }

    const generatedMessages = [];

    // İlanları sırayla işle (Gerçekte Promise.all ile paralel yapılabilir ama API rate limitleri için sıralı daha güvenli)
    for (const listingId of listingIds) {
      const listing = await prisma.huntedListing.findUnique({ where: { id: listingId } });
      if (!listing) continue;

      const prompt = PROMPTS.huntingMessage(
        {
          title: listing.title,
          price: listing.price || undefined,
          location: listing.location || undefined,
        },
        {
          companyName: companyProfile.companyName,
          strengths: companyProfile.strengths,
          uniquePoints: companyProfile.uniquePoints,
        },
        tone
      );

      const response = await callAI([{ role: 'user', content: prompt }], 'hunting');

      const message = await prisma.huntingMessage.create({
        data: {
          listingId: listing.id,
          content: response.content,
          tone,
        },
      });
      
      generatedMessages.push({ listingId, message });
    }

    return NextResponse.json({ success: true, count: generatedMessages.length, messages: generatedMessages });
  } catch (error) {
    console.error('Error generating bulk messages:', error);
    return NextResponse.json({ error: 'Mesajlar üretilirken hata oluştu' }, { status: 500 });
  }
}
