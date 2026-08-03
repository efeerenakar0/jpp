import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaOwner } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { decryptPartnerCredential, encryptPartnerCredential } from '@/lib/partner-outreach/crypto';
import { refreshPartnerGoogleAccessToken } from '@/lib/partner-outreach/google';

export async function POST() {
  try {
    const principal = await requireFabrikaOwner();
    const mailbox = await prisma.partnerMailboxConnection.findUnique({ where: { companyAccountId: principal.account.id } });
    if (!mailbox || mailbox.status === 'REVOKED') throw new Error('Bağlı gönderici hesabı bulunamadı.');
    let accessToken = mailbox.encryptedAccessToken ? decryptPartnerCredential(mailbox.encryptedAccessToken) : null;
    if (!accessToken || !mailbox.accessTokenExpiresAt || mailbox.accessTokenExpiresAt.getTime() < Date.now() + 30_000) {
      const refreshed = await refreshPartnerGoogleAccessToken(mailbox.encryptedRefreshToken);
      accessToken = refreshed.access_token;
      await prisma.partnerMailboxConnection.update({ where: { id: mailbox.id }, data: { encryptedAccessToken: encryptPartnerCredential(accessToken), accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000 - 60_000) } });
    }
    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', { headers: { Authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error('Gönderici hesabına erişilemiyor. Lütfen yeniden bağlayın.');
    await prisma.partnerMailboxConnection.update({ where: { id: mailbox.id }, data: { status: 'CONNECTED', lastTestedAt: new Date(), lastErrorCode: null } });
    return NextResponse.json({ success: true, message: 'Gönderici hesabı sağlıklı.' });
  } catch (error) { return partnerApiError(error); }
}
