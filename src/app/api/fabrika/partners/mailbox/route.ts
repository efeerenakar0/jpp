import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { partnerGmailConfigured } from '@/lib/partner-outreach/google';

export async function GET() {
  try {
    const principal = await requireFabrikaOwner();
    const mailbox = await prisma.partnerMailboxConnection.findUnique({ where: { companyAccountId: principal.account.id }, select: {
      id: true, status: true, email: true, grantedScopes: true, lastTestedAt: true,
      lastSuccessfulSendAt: true, lastErrorCode: true, lastErrorAt: true, connectedById: true, createdAt: true,
    } });
    return NextResponse.json({ success: true, configured: partnerGmailConfigured(), mailbox });
  } catch (error) { return partnerApiError(error); }
}
