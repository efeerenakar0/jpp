import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { needsCustomerReplyRepair } from '@/lib/customer-message';
import { requireFabrikaOwner } from '@/lib/fabrika-session';

async function findCleanupCandidates(companyAccountId: string) {
  const [testConversations, legacyAssistantMessages] = await Promise.all([
    prisma.customerConversation.findMany({
      where: {
        companyAccountId,
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
        conversation: { companyAccountId },
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
    const principal = await requireFabrikaOwner();
    const candidates = await findCleanupCandidates(principal.account.id);
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
    const principal = await requireFabrikaOwner();
    const candidates = await findCleanupCandidates(principal.account.id);
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
