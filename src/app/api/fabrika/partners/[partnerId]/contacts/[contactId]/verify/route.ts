import { NextResponse } from 'next/server';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';

const schema = z.object({
  decision: z.enum(['VERIFY', 'REJECT']),
  note: z.string().trim().min(5).max(1000),
});

export async function POST(request: Request, context: { params: Promise<{ partnerId: string; contactId: string }> }) {
  try {
    const principal = await requireFabrikaOwner();
    const { partnerId, contactId } = await context.params;
    const input = schema.parse(await request.json());
    const contact = await prisma.partnerContact.findFirst({
      where: {
        id: contactId,
        organizationId: partnerId,
        companyAccountId: principal.account.id,
        active: true,
      },
      select: { id: true, organizationId: true, emailMasked: true },
    });
    if (!contact) throw new Error('Kurumsal iletişim kaydı bulunamadı.');
    const status = input.decision === 'VERIFY' ? 'MANUALLY_VERIFIED' : 'REJECTED';
    const actorId = principal.account.id;
    await prisma.$transaction([
      prisma.partnerContact.update({
        where: { id: contact.id },
        data: { verificationStatus: status, verifiedAt: input.decision === 'VERIFY' ? new Date() : null },
      }),
      prisma.partnerActivity.create({
        data: {
          companyAccountId: principal.account.id,
          organizationId: contact.organizationId,
          type: input.decision === 'VERIFY' ? 'CONTACT_MANUALLY_VERIFIED' : 'CONTACT_REJECTED',
          actorType: principal.type,
          actorId,
          summary: input.decision === 'VERIFY' ? `${contact.emailMasked || 'Kurumsal iletişim'} patron tarafından doğrulandı.` : `${contact.emailMasked || 'Kurumsal iletişim'} reddedildi.`,
          metadata: { contactId: contact.id, note: input.note },
        },
      }),
      ...(input.decision === 'REJECT'
        ? [prisma.partnerEmailMessage.updateMany({
            where: { companyAccountId: principal.account.id, contactId: contact.id, status: { in: ['QUEUED', 'RETRY'] } },
            data: { status: 'CANCELLED', lastErrorCode: 'CONTACT_REJECTED' },
          })]
        : []),
    ]);
    return NextResponse.json({ success: true, status });
  } catch (error) {
    return partnerApiError(error);
  }
}
