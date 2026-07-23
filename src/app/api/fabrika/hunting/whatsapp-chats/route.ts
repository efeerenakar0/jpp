import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    // 1. Fetch all messages from Prisma DB
    const allMessages = await prisma.whatsAppMessage.findMany({
      orderBy: { createdAt: 'desc' }
    });

    // 2. Also fetch HuntedListings to map owner names/phones
    const listings = await prisma.huntedListing.findMany({
      select: { ownerPhone: true, ownerName: true, title: true }
    });

    const phoneToNameMap = new Map<string, string>();
    for (const listing of listings) {
      if (listing.ownerPhone) {
        const clean = listing.ownerPhone.replace(/[^0-9]/g, '');
        phoneToNameMap.set(clean, listing.ownerName || listing.title);
      }
    }

    // 3. Group messages by phone number to construct chat list
    const chatsMap = new Map();

    for (const msg of allMessages) {
      const cleanPhone = msg.phone.replace(/[^0-9]/g, '');
      if (!chatsMap.has(cleanPhone)) {
        const displayName = phoneToNameMap.get(cleanPhone) || cleanPhone;
        chatsMap.set(cleanPhone, {
          phone: cleanPhone,
          name: displayName,
          lastMessage: msg.content,
          lastMessageTime: msg.createdAt,
          unreadCount: 0,
          hasDraft: msg.status === 'DRAFT'
        });
      } else {
        if (msg.status === 'DRAFT') {
          chatsMap.get(cleanPhone).hasDraft = true;
        }
      }
    }

    const chats = Array.from(chatsMap.values());
    chats.sort((a, b) => new Date(b.lastMessageTime).getTime() - new Date(a.lastMessageTime).getTime());

    return NextResponse.json(chats);
  } catch (error) {
    console.error('Sohbet listesi getirme hatası:', error);
    return NextResponse.json({ error: 'Sunucu hatası' }, { status: 500 });
  }
}
