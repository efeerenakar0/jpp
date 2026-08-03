import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { revokePartnerGoogleToken } from '@/lib/partner-outreach/google';

export async function DELETE() {
  try {
    const principal = await requireFabrikaOwner();
    const mailbox = await prisma.partnerMailboxConnection.findUnique({ where: { companyAccountId: principal.account.id } });
    if (mailbox) {
      await revokePartnerGoogleToken(mailbox.encryptedRefreshToken);
      await prisma.$transaction([
        prisma.partnerEmailMessage.updateMany({ where: { companyAccountId: principal.account.id, status: { in: ['QUEUED', 'RETRY'] } }, data: { status: 'CANCELLED', lastErrorCode: 'MAILBOX_DISCONNECTED' } }),
        prisma.partnerMailboxConnection.update({ where: { id: mailbox.id }, data: { status: 'REVOKED', revokedAt: new Date(), encryptedAccessToken: null, lastErrorCode: null } }),
      ]);
    }
    return NextResponse.json({ success: true });
  } catch (error) { return partnerApiError(error); }
}
