import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callAI, PROMPTS } from '@/lib/ai';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import {
  huntingApiError,
  principalActor,
} from '@/lib/hunting-v2/api';
import { enforceHuntingRateLimit } from '@/lib/hunting-v2/rate-limit';
import prisma from '@/lib/prisma';

export const runtime = 'nodejs';

const bodySchema = z
  .object({
    listingIds: z.array(z.string().min(1)).min(1).max(25),
    tone: z.enum(['samimi', 'resmi', 'acil']).default('samimi'),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const actor = principalActor(principal);
    enforceHuntingRateLimit(
      `draft:${principal.account.id}:${actor.key}`,
      { limit: 20, windowMs: 60_000 }
    );
    const body = bodySchema.parse(await request.json());
    const listings = await prisma.huntedListing.findMany({
      where: {
        id: { in: body.listingIds },
        companyAccountId: principal.account.id,
      },
      select: {
        id: true,
        title: true,
        price: true,
        province: true,
        district: true,
        neighborhood: true,
      },
    });
    if (listings.length !== new Set(body.listingIds).size) {
      throw new Error('Bir veya daha fazla ilan bu şirkette bulunamadı.');
    }

    const generatedMessages = [];
    for (const listing of listings) {
      const location = [
        listing.province,
        listing.district,
        listing.neighborhood,
      ]
        .filter(Boolean)
        .join(' / ');
      const prompt = PROMPTS.huntingMessage(
        {
          title: listing.title,
          price: listing.price || undefined,
          location: location || undefined,
        },
        {
          companyName: principal.account.companyName,
          strengths: [],
          uniquePoints: [],
        },
        body.tone
      );
      const response = await callAI(
        [{ role: 'user', content: prompt }],
        'hunting-draft'
      );
      const message = await prisma.huntingMessage.create({
        data: {
          listingId: listing.id,
          content: response.content.trim().slice(0, 4000),
          tone: body.tone,
          sent: false,
        },
      });
      generatedMessages.push({ listingId: listing.id, message });
    }

    return NextResponse.json({
      success: true,
      count: generatedMessages.length,
      messages: generatedMessages,
      autoSent: false,
    });
  } catch (error) {
    return huntingApiError(error);
  }
}
