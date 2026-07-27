import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';

export async function POST(req: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { messageId } = await req.json();
    if (!messageId) return NextResponse.json({ error: 'Message ID required' }, { status: 400 });

    const deleted = await prisma.whatsAppMessage.deleteMany({
      where: {
        id: messageId,
        companyAccountId: principal.account.id,
        status: 'DRAFT',
      }
    });
    if (deleted.count === 0) {
      return NextResponse.json({ error: 'Taslak bulunamadı.' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Draft cancel error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
