import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { queueCompanyWhatsAppMessage } from '@/lib/company-whatsapp';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import {
  ContactPolicyDeniedError,
  requireContactPolicyApproval,
} from '@/lib/hunting-v2/contact-service';

const requestSchema = z
  .object({
    phone: z.string().trim().min(10).max(32).optional(),
    message: z.string().trim().min(1).max(4000),
    requestId: z.string().uuid(),
    messageId: z.string().trim().optional(),
    listingId: z.string().trim().optional(),
    huntedContactId: z.string().trim().optional(),
    purpose: z.literal('SALES_AUTHORITY_DISCUSSION').optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.listingId) {
      if (!value.huntedContactId || !value.purpose) {
        context.addIssue({
          code: 'custom',
          message:
            'Avcı mesajında doğrulanmış kişi ve satış yetkisi amacı zorunludur.',
        });
      }
    } else if (!value.phone) {
      context.addIssue({
        code: 'custom',
        message: 'Telefon zorunludur.',
      });
    }
  });

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = requestSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Telefon ve mesaj alanlarını kontrol edin.' },
        { status: 400 }
      );
    }
    const actorId =
      principal.type === 'EMPLOYEE'
        ? principal.member.id
        : principal.account.id;
    const approvedContact =
      parsed.data.listingId &&
      parsed.data.huntedContactId &&
      parsed.data.purpose
        ? await requireContactPolicyApproval({
            companyAccountId: principal.account.id,
            listingId: parsed.data.listingId,
            contactId: parsed.data.huntedContactId,
            channel: 'WHATSAPP',
            purpose: parsed.data.purpose,
            evaluatedBy: `${principal.type}:${actorId}`,
          })
        : null;
    const phone =
      approvedContact?.phone || parsed.data.phone?.replace(/\D/g, '') || '';
    const idempotencyKey = `manual-send:${parsed.data.requestId}`;
    const result = await prisma.$transaction(async (tx) => {
      const draft = parsed.data.messageId
        ? await tx.whatsAppMessage.findFirst({
            where: {
              id: parsed.data.messageId,
              companyAccountId: principal.account.id,
            },
          })
        : null;
      if (parsed.data.messageId && !draft) {
        throw new Error('MANUAL_SEND_DRAFT_NOT_FOUND');
      }
      if (
        draft &&
        draft.status !== 'DRAFT' &&
        (draft.content !== parsed.data.message ||
          !draft.providerMessageId?.startsWith('queue:'))
      ) {
        throw new Error('MANUAL_SEND_DRAFT_ALREADY_USED');
      }

      const previousIncoming = await tx.whatsAppMessage.findFirst({
        where: {
          companyAccountId: principal.account.id,
          phone,
          fromMe: false,
        },
        select: { id: true },
      });
      const delivery = await queueCompanyWhatsAppMessage({
        companyAccountId: principal.account.id,
        to: phone,
        text: parsed.data.message,
        listingId: parsed.data.listingId,
        huntedContactId: parsed.data.huntedContactId,
        purpose: parsed.data.purpose,
        idempotencyKey,
        createdByType: principal.type,
        createdById: actorId,
        firstContact: !previousIncoming,
        metadata: {
          clientRequestId: parsed.data.requestId,
          draftMessageId: parsed.data.messageId || null,
          source: 'MANUAL_PANEL_SEND',
        },
        tx,
        deferDispatch: true,
      });

      let conversation = delivery.conversationId
        ? await tx.customerConversation.findFirst({
            where: {
              id: delivery.conversationId,
              companyAccountId: principal.account.id,
              customerPhone: phone,
              channel: 'WHATSAPP',
            },
            select: { id: true },
          })
        : null;
      if (delivery.conversationId && !conversation) {
        throw new Error('MANUAL_SEND_CONVERSATION_MISMATCH');
      }
      if (!conversation) {
        conversation =
          (await tx.customerConversation.findFirst({
            where: {
              companyAccountId: principal.account.id,
              customerPhone: phone,
              channel: 'WHATSAPP',
              isActive: true,
            },
            select: { id: true },
          })) ||
          (await tx.customerConversation.create({
            data: {
              companyAccountId: principal.account.id,
              customerName: draft?.phone || phone,
              customerPhone: phone,
              channel: 'WHATSAPP',
              summary: parsed.data.message,
            },
            select: { id: true },
          }));
        const attached = await tx.whatsAppOutboxMessage.updateMany({
          where: {
            id: delivery.outboxId,
            companyAccountId: principal.account.id,
            conversationId: null,
          },
          data: { conversationId: conversation.id },
        });
        if (attached.count === 0) {
          throw new Error('MANUAL_SEND_CONVERSATION_ATTACH_FAILED');
        }
      }

      let message;
      if (draft) {
        const updated = await tx.whatsAppMessage.updateMany({
          where: {
            id: draft.id,
            companyAccountId: principal.account.id,
            OR: [
              { status: 'DRAFT' },
              { providerMessageId: delivery.providerMessageId },
            ],
          },
          data: {
            status: delivery.deliveryStatus,
            content: parsed.data.message,
            providerMessageId: delivery.providerMessageId,
          },
        });
        if (updated.count === 0) {
          throw new Error('MANUAL_SEND_DRAFT_ALREADY_USED');
        }
        message = await tx.whatsAppMessage.findUniqueOrThrow({
          where: { id: draft.id },
        });
      } else {
        const existing = await tx.whatsAppMessage.findUnique({
          where: { providerMessageId: delivery.providerMessageId },
        });
        if (
          existing &&
          (existing.companyAccountId !== principal.account.id ||
            !existing.fromMe ||
            existing.phone !== phone ||
            existing.content !== parsed.data.message)
        ) {
          throw new Error('MANUAL_SEND_IDEMPOTENCY_CONFLICT');
        }
        message =
          existing ||
          (await tx.whatsAppMessage.create({
            data: {
              companyAccountId: principal.account.id,
              phone,
              fromMe: true,
              content: parsed.data.message,
              status: delivery.deliveryStatus,
              providerMessageId: delivery.providerMessageId,
            },
          }));
      }

      const existingConversationMessage =
        await tx.conversationMessage.findUnique({
          where: { providerMessageId: delivery.providerMessageId },
        });
      if (
        existingConversationMessage &&
        (existingConversationMessage.conversationId !== conversation.id ||
          existingConversationMessage.content !== parsed.data.message)
      ) {
        throw new Error('MANUAL_SEND_IDEMPOTENCY_CONFLICT');
      }
      if (!existingConversationMessage) {
        await tx.conversationMessage.create({
          data: {
            conversationId: conversation.id,
            role: 'patron',
            content: parsed.data.message,
            providerMessageId: delivery.providerMessageId,
            deliveryStatus: delivery.deliveryStatus,
            messageType: 'TEXT',
            metadata: JSON.stringify({
              provider: 'waha',
              channel: 'whatsapp',
              outboxId: delivery.outboxId,
              clientRequestId: parsed.data.requestId,
            }),
          },
        });
      }
      return { delivery, message };
    });
    return NextResponse.json({
      success: true,
      queued: result.delivery.queued,
      warning: result.delivery.lastError,
      message: result.message,
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }
    if (error instanceof ContactPolicyDeniedError) {
      return NextResponse.json(
        {
          error: 'İletişim izinleri gönderime uygun değil.',
          reasonCodes: error.reasonCodes,
        },
        { status: 403 }
      );
    }
    if (
      error instanceof Error &&
      error.message === 'MANUAL_SEND_DRAFT_NOT_FOUND'
    ) {
      return NextResponse.json({ error: 'Taslak bulunamadı.' }, { status: 404 });
    }
    if (error instanceof Error && error.message.startsWith('MANUAL_SEND_')) {
      return NextResponse.json(
        { error: 'Bu gönderim isteği daha önce farklı bilgilerle kullanılmış.' },
        { status: 409 }
      );
    }
    const message =
      error instanceof Error ? error.message : 'Mesaj gönderilemedi.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
