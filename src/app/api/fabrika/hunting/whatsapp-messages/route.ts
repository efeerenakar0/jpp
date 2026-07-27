import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

export async function POST(req: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { phone } = await req.json();
    if (!phone) return NextResponse.json({ error: 'Eksik parametre' }, { status: 400 });

    const cleanPhone = phone.replace(/[^0-9]/g, '');

    // Fetch all messages for this phone number from Prisma DB
    const messages = await prisma.whatsAppMessage.findMany({
      where: {
        companyAccountId: principal.account.id,
        phone: cleanPhone
      },
      orderBy: { createdAt: 'asc' }
    });

    return NextResponse.json(messages);
  } catch (error) {
    console.error('Mesajları getirme hatası:', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
