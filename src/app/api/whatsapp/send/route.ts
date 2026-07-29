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
    const draft = parsed.data.messageId
      ? await prisma.whatsAppMessage.findFirst({
          where: {
            id: parsed.data.messageId,
            companyAccountId: principal.account.id,
            status: 'DRAFT',
          },
        })
      : null;
    if (parsed.data.messageId && !draft) {
      return NextResponse.json({ error: 'Taslak bulunamadı.' }, { status: 404 });
    }
    const previousIncoming = await prisma.whatsAppMessage.findFirst({
      where: {
        companyAccountId: principal.account.id,
        phone,
        fromMe: false,
      },
      select: { id: true },
    });
    const conversation =
      (await prisma.customerConversation.findFirst({
        where: {
          companyAccountId: principal.account.id,
          customerPhone: phone,
          channel: 'WHATSAPP',
          isActive: true,
        },
        select: { id: true },
      })) ||
      (await prisma.customerConversation.create({
        data: {
          companyAccountId: principal.account.id,
          customerName: draft?.phone || phone,
          customerPhone: phone,
          channel: 'WHATSAPP',
          summary: parsed.data.message,
        },
        select: { id: true },
      }));
    const delivery = await queueCompanyWhatsAppMessage({
      companyAccountId: principal.account.id,
      to: phone,
      text: parsed.data.message,
      conversationId: conversation.id,
      listingId: parsed.data.listingId,
      huntedContactId: parsed.data.huntedContactId,
      purpose: parsed.data.purpose,
      idempotencyKey: draft ? `hunter-draft:${draft.id}` : undefined,
      createdByType: principal.type,
      createdById: actorId,
      firstContact: !previousIncoming,
    });
    const message = draft
      ? await prisma.whatsAppMessage.update({
          where: { id: draft.id },
          data: {
            status: delivery.deliveryStatus,
            content: parsed.data.message,
            providerMessageId: delivery.providerMessageId,
          },
        })
      : await prisma.whatsAppMessage.create({
          data: {
            companyAccountId: principal.account.id,
            phone,
            fromMe: true,
            content: parsed.data.message,
            status: delivery.deliveryStatus,
            providerMessageId: delivery.providerMessageId,
          },
        });
    await prisma.conversationMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'patron',
        content: parsed.data.message,
        providerMessageId: delivery.providerMessageId,
        deliveryStatus: delivery.deliveryStatus,
        messageType: 'TEXT',
        metadata: JSON.stringify({ provider: 'waha', channel: 'whatsapp' }),
      },
    });
    return NextResponse.json({
      success: true,
      queued: delivery.queued,
      warning: delivery.lastError,
      message,
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
    const message =
      error instanceof Error ? error.message : 'Mesaj gönderilemedi.';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
