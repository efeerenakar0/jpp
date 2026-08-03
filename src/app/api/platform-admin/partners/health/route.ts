import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';
import { partnerGmailConfigured } from '@/lib/partner-outreach/google';

export async function GET() {
  if (!(await requirePlatformAdmin())) return NextResponse.json({ success: false }, { status: 401 });
  const [mailboxes, queued, failed, policies] = await Promise.all([
    prisma.partnerMailboxConnection.groupBy({ by: ['status'], _count: true }),
    prisma.partnerEmailMessage.count({ where: { status: { in: ['QUEUED', 'RETRY', 'SENDING'] } } }),
    prisma.partnerEmailMessage.count({ where: { status: 'FAILED' } }),
    prisma.partnerCountryPolicy.count({ where: { reviewedAt: { not: null } } }),
  ]);
  return NextResponse.json({ success: true, providers: { authorizedDirectory: { configured: false, message: 'Yetkili canlı dizin sağlayıcısı yapılandırılmadı.' }, gmail: { configured: partnerGmailConfigured() }, csv: { configured: true }, signedFeed: { configured: Boolean(process.env.PARTNER_FEED_SIGNING_SECRET?.trim()) } }, mailboxes, outbox: { queued, failed }, reviewedCountryPolicies: policies });
}
