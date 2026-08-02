import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { callAI, PROMPTS } from '@/lib/ai';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { z } from 'zod';

const requestSchema = z.object({
  listingId: z.string().min(1),
  tone: z.string().trim().min(1).max(80),
});

export async function POST(req: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = requestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'İlan ve mesaj tonu bilgilerini kontrol edin.' },
        { status: 400 }
      );
    }
    const { listingId, tone } = parsed.data;

    const listing = await prisma.huntedListing.findFirst({
      where: { id: listingId, companyAccountId: principal.account.id },
    });

    if (!listing) {
      return NextResponse.json({ error: 'İlan bulunamadı.' }, { status: 404 });
    }

    const onboarding =
      principal.account.onboardingState &&
      typeof principal.account.onboardingState === 'object' &&
      !Array.isArray(principal.account.onboardingState)
        ? (principal.account.onboardingState as Record<string, unknown>)
        : {};
    const strengths = Array.isArray(onboarding.strengths)
      ? onboarding.strengths.filter(
          (item): item is string => typeof item === 'string'
        )
      : ['Doğrulanmış portföy bilgisi', 'İnsan onaylı iletişim'];
    const uniquePoints = Array.isArray(onboarding.uniquePoints)
      ? onboarding.uniquePoints.filter(
          (item): item is string => typeof item === 'string'
        )
      : ['Şeffaf danışmanlık', 'Güncel portföy takibi'];

    const promptText = PROMPTS.huntingMessage(
      { title: listing.title, price: listing.price || undefined, location: listing.location || undefined },
      {
        companyName: principal.account.companyName,
        strengths,
        uniquePoints,
      },
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
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json(
        { error: 'Fabrika oturumu gerekli.' },
        { status: 401 }
      );
    }
    console.error('Error generating message:', error);
    return NextResponse.json(
      { error: 'Mesaj şu anda üretilemedi.' },
      { status: 500 }
    );
  }
}
