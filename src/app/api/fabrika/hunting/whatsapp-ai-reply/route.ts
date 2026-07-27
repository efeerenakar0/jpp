import { NextResponse } from 'next/server';
import { z } from 'zod';
import { callAI } from '@/lib/ai';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import prisma from '@/lib/prisma';

const requestSchema = z.object({
  phone: z.string().trim().min(10).max(32),
  chatHistory: z
    .array(
      z.object({
        fromMe: z.boolean(),
        content: z.string().max(4000),
      })
    )
    .max(40)
    .optional(),
});

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: 'Telefon bilgisi eksik.' }, { status: 400 });
    }
    const phone = parsed.data.phone.replace(/\D/g, '');
    const storedHistory = await prisma.whatsAppMessage.findMany({
      where: { companyAccountId: principal.account.id, phone },
      orderBy: { createdAt: 'asc' },
      take: 40,
      select: { fromMe: true, content: true },
    });
    const history = parsed.data.chatHistory || storedHistory;
    const listings = await prisma.huntedListing.findMany({
      where: {
        companyAccountId: principal.account.id,
        ownerPhone: { not: null },
      },
      take: 100,
    });
    const listing = listings.find((item) => {
      const listingPhone = item.ownerPhone?.replace(/\D/g, '') || '';
      return (
        listingPhone === phone ||
        listingPhone.endsWith(phone) ||
        phone.endsWith(listingPhone)
      );
    });
    const context = listing
      ? {
          title: listing.title,
          price: listing.price,
          ownerName: listing.ownerName,
          notes: listing.notes,
        }
      : null;
    const result = await callAI(
      [
        {
          role: 'system',
          content:
            'Sen profesyonel bir emlak portföy kazanım uzmanısın. Yalnızca verilen ilan ve konuşma verilerine dayan. Kısa, doğal, saygılı Türkçe WhatsApp yanıtı yaz. Baskı, toplu mesaj, sahte vaat veya yapay zeka açıklaması kullanma. En fazla 500 karakter ve yalnızca gönderilecek metin.',
        },
        {
          role: 'user',
          content: JSON.stringify({ listing: context, history }),
        },
      ],
      'hunter-whatsapp-draft'
    );
    const reply = result.content.trim().slice(0, 500);
    const draft = await prisma.whatsAppMessage.create({
      data: {
        companyAccountId: principal.account.id,
        phone,
        fromMe: true,
        content: reply,
        status: 'DRAFT',
      },
    });
    return NextResponse.json({ reply, draft });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'AI yanıtı üretilemedi.',
      },
      { status: 500 }
    );
  }
}
