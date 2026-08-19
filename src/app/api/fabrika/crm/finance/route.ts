import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';

const optionalId = z.string().trim().min(1).optional().nullable();
const optionalText = z.string().trim().max(1000).optional().nullable();

const createEntrySchema = z.object({
  action: z.literal('create-entry'),
  contactId: z.string().trim().min(1),
  dealId: optionalId,
  propertyId: optionalId,
  kind: z.enum(['DEBIT', 'PAYMENT', 'DEPOSIT', 'COMMISSION', 'EXPENSE', 'REFUND']),
  status: z.enum(['PLANNED', 'PAID', 'OVERDUE']).default('PLANNED'),
  amount: z.coerce.number().finite().positive().max(1_000_000_000),
  currency: z.enum(['TRY', 'USD', 'EUR', 'GBP']).default('TRY'),
  occurredAt: z.string().datetime(),
  dueAt: z.string().datetime().optional().nullable(),
  method: z.string().trim().max(120).optional().nullable(),
  reference: z.string().trim().max(160).optional().nullable(),
  description: optionalText,
});

const reverseEntrySchema = z.object({
  action: z.literal('reverse-entry'),
  activityId: z.string().trim().min(1),
  reason: optionalText,
});

const financeActionSchema = z.discriminatedUnion('action', [
  createEntrySchema,
  reverseEntrySchema,
]);

const kindLabels = {
  DEBIT: 'Borç kaydı',
  PAYMENT: 'Tahsilat',
  DEPOSIT: 'Kapora',
  COMMISSION: 'Komisyon tahakkuku',
  EXPENSE: 'Müşteri masrafı',
  REFUND: 'İade',
} as const;

function errorResponse(message: string, status: number) {
  return NextResponse.json({ success: false, error: message }, { status });
}

async function ownedResourceExists(
  resource: 'deal' | 'property',
  id: string | null | undefined,
  companyAccountId: string
) {
  if (!id) return true;
  if (resource === 'deal') {
    return Boolean(
      await prisma.crmDeal.findFirst({
        where: { id, companyAccountId },
        select: { id: true },
      })
    );
  }
  return Boolean(
    await prisma.crmProperty.findFirst({
      where: { id, companyAccountId },
      select: { id: true },
    })
  );
}

export async function POST(request: Request) {
  try {
    const principal = await requireFabrikaPrincipal();
    const parsed = financeActionSchema.safeParse(await request.json());
    if (!parsed.success) {
      return errorResponse(parsed.error.issues[0]?.message || 'Geçersiz finans işlemi.', 400);
    }

    const input = parsed.data;
    const companyAccountId = principal.account.id;

    if (input.action === 'create-entry') {
      const [contact, dealOwned, propertyOwned] = await Promise.all([
        prisma.crmContact.findFirst({
          where: { id: input.contactId, companyAccountId },
          select: { id: true, name: true },
        }),
        ownedResourceExists('deal', input.dealId, companyAccountId),
        ownedResourceExists('property', input.propertyId, companyAccountId),
      ]);

      if (!contact) return errorResponse('Müşteri bulunamadı.', 404);
      if (!dealOwned) return errorResponse('Satış fırsatı bulunamadı.', 404);
      if (!propertyOwned) return errorResponse('Portföy bulunamadı.', 404);

      const activity = await prisma.crmActivity.create({
        data: {
          companyAccountId,
          contactId: contact.id,
          dealId: input.dealId || null,
          propertyId: input.propertyId || null,
          actorMemberId: principal.member?.id || null,
          type: 'CRM_FINANCE_ENTRY',
          title: kindLabels[input.kind],
          description: input.description || `${contact.name} için finans hareketi`,
          metadata: JSON.stringify({
            version: 1,
            contactId: contact.id,
            dealId: input.dealId || null,
            propertyId: input.propertyId || null,
            kind: input.kind,
            status: input.status,
            amount: input.amount,
            currency: input.currency,
            occurredAt: input.occurredAt,
            dueAt: input.dueAt || null,
            method: input.method || null,
            reference: input.reference || null,
            description: input.description || null,
          }),
        },
        select: { id: true, createdAt: true },
      });

      return NextResponse.json({
        success: true,
        entry: activity,
        message: `${kindLabels[input.kind]} kaydedildi.`,
      });
    }

    const original = await prisma.crmActivity.findFirst({
      where: {
        id: input.activityId,
        companyAccountId,
        type: 'CRM_FINANCE_ENTRY',
      },
      select: {
        id: true,
        contactId: true,
        propertyId: true,
        dealId: true,
      },
    });
    if (!original) return errorResponse('Cari hareket bulunamadı.', 404);

    const existingReversal = await prisma.crmActivity.findFirst({
      where: {
        companyAccountId,
        type: 'CRM_FINANCE_REVERSAL',
        metadata: { contains: `"reversesActivityId":"${original.id}"` },
      },
      select: { id: true },
    });
    if (existingReversal) return errorResponse('Bu hareket daha önce iptal edilmiş.', 409);

    await prisma.crmActivity.create({
      data: {
        companyAccountId,
        contactId: original.contactId,
        propertyId: original.propertyId,
        dealId: original.dealId,
        actorMemberId: principal.member?.id || null,
        type: 'CRM_FINANCE_REVERSAL',
        title: 'Cari hareket iptal edildi',
        description: input.reason || 'Kullanıcı tarafından iptal edildi.',
        metadata: JSON.stringify({
          version: 1,
          reversesActivityId: original.id,
          reason: input.reason || null,
        }),
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Cari hareket iptal edildi; denetim kaydı korundu.',
    });
  } catch (error) {
    if (error instanceof FabrikaSessionError) {
      return errorResponse('Oturum gerekli.', 401);
    }
    console.error('CRM finance error:', error);
    return errorResponse('Finans işlemi tamamlanamadı.', 500);
  }
}
