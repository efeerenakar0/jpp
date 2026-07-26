import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { needsCustomerReplyRepair } from '@/lib/customer-message';

async function findCleanupCandidates() {
  const [testConversations, legacyAssistantMessages] = await Promise.all([
    prisma.customerConversation.findMany({
      where: {
        OR: [
          { customerName: { contains: 'test', mode: 'insensitive' } },
          { customerName: { contains: 'demo', mode: 'insensitive' } },
          { customerName: { contains: 'örnek', mode: 'insensitive' } },
        ],
      },
      select: { id: true, customerName: true },
    }),
    prisma.conversationMessage.findMany({
      where: {
        role: 'assistant',
        providerMessageId: null,
      },
      select: { id: true, content: true },
    }),
  ]);
  const invalidMessages = legacyAssistantMessages.filter(
    (message) =>
      needsCustomerReplyRepair(message.content) ||
      /\b(potvr\w*|pù\w*|führsuz)\b/iu.test(message.content)
  );

  return { testConversations, invalidMessages };
}

export async function GET() {
  try {
    const candidates = await findCleanupCandidates();
    return NextResponse.json({
      testConversationCount: candidates.testConversations.length,
      invalidMessageCount: candidates.invalidMessages.length,
      testConversationNames: candidates.testConversations.map(
        (conversation) => conversation.customerName
      ),
    });
  } catch (error) {
    console.error('[Assistant Cleanup Preview Error]:', error);
    return NextResponse.json(
      { error: 'Temizlik önizlemesi hazırlanamadı.' },
      { status: 503 }
    );
  }
}

export async function DELETE() {
  try {
    const candidates = await findCleanupCandidates();
    const [deletedMessages, deletedConversations] = await prisma.$transaction([
      prisma.conversationMessage.deleteMany({
        where: {
          id: { in: candidates.invalidMessages.map((message) => message.id) },
        },
      }),
      prisma.customerConversation.deleteMany({
        where: {
          id: {
            in: candidates.testConversations.map(
              (conversation) => conversation.id
            ),
          },
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      deletedTestConversations: deletedConversations.count,
      deletedInvalidMessages: deletedMessages.count,
    });
  } catch (error) {
    console.error('[Assistant Cleanup Error]:', error);
    return NextResponse.json(
      { error: 'Test ve hatalı kayıtlar temizlenemedi.' },
      { status: 503 }
    );
  }
}
