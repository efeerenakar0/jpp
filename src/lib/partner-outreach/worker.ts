import 'server-only';

import { randomUUID } from 'node:crypto';
import prisma from '@/lib/prisma';
import { draftContentHash } from './ai-draft';
import { decryptPartnerCredential, encryptPartnerCredential } from './crypto';
import { refreshPartnerGoogleAccessToken, sendPartnerGmail } from './google';
import { classifyPartnerEmailFailure, nextPartnerEmailRetryAt } from './outbox-policy';
import { decryptedPartnerContactEmail } from './service';

async function claimMessage(now: Date) {
  const candidate = await prisma.partnerEmailMessage.findFirst({
    where: {
      OR: [
        {
          status: { in: ['QUEUED', 'RETRY'] },
          nextAttemptAt: { lte: now },
          OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }],
        },
        { status: 'SENDING', leaseExpiresAt: { lt: now } },
      ],
    },
    orderBy: [{ nextAttemptAt: 'asc' }, { createdAt: 'asc' }],
    select: { id: true, status: true },
  });
  if (!candidate) return null;
  const leaseToken = randomUUID();
  const claimed = await prisma.partnerEmailMessage.updateMany({
    where: { id: candidate.id, status: candidate.status, OR: [{ leaseExpiresAt: null }, { leaseExpiresAt: { lt: now } }] },
    data: { status: 'SENDING', claimedAt: now, leaseToken, leaseExpiresAt: new Date(now.getTime() + 2 * 60_000), attemptCount: { increment: 1 } },
  });
  if (claimed.count !== 1) return null;
  await prisma.partnerEmailEvent.create({ data: {
    companyAccountId: (await prisma.partnerEmailMessage.findUniqueOrThrow({ where: { id: candidate.id }, select: { companyAccountId: true } })).companyAccountId,
    messageId: candidate.id, type: 'CLAIMED', metadata: { leaseToken },
  } });
  return { id: candidate.id, leaseToken };
}

async function accessTokenForMailbox(mailbox: {
  id: string;
  encryptedAccessToken: string | null;
  encryptedRefreshToken: string;
  accessTokenExpiresAt: Date | null;
}) {
  if (mailbox.encryptedAccessToken && mailbox.accessTokenExpiresAt && mailbox.accessTokenExpiresAt.getTime() > Date.now() + 30_000) {
    return decryptPartnerCredential(mailbox.encryptedAccessToken);
  }
  const refreshed = await refreshPartnerGoogleAccessToken(mailbox.encryptedRefreshToken);
  await prisma.partnerMailboxConnection.update({ where: { id: mailbox.id }, data: {
    encryptedAccessToken: encryptPartnerCredential(refreshed.access_token),
    accessTokenExpiresAt: new Date(Date.now() + refreshed.expires_in * 1000 - 60_000),
    status: 'CONNECTED', lastErrorCode: null,
  } });
  return refreshed.access_token;
}

async function processClaim(claim: { id: string; leaseToken: string }, now: Date) {
  const message = await prisma.partnerEmailMessage.findFirst({
    where: { id: claim.id, leaseToken: claim.leaseToken, status: 'SENDING' },
    include: { contact: true, draft: true, approval: true, organization: true, mailboxConnection: true },
  });
  if (!message) return 'LOST_LEASE';
  const suppression = await prisma.partnerSuppression.findUnique({
    where: { companyAccountId_emailHmac: { companyAccountId: message.companyAccountId, emailHmac: message.recipientEmailHmac } },
  });
  const countryPolicy = await prisma.partnerCountryPolicy.findUnique({
    where: { companyAccountId_countryCode: { companyAccountId: message.companyAccountId, countryCode: message.organization.countryCode } },
  });
  const stale = !message.approval || message.approval.status !== 'APPROVED' ||
    message.approval.approvedHash !== message.draft.contentHash ||
    message.draft.contentHash !== draftContentHash(message.subjectSnapshot, message.bodySnapshot);
  const unverifiedContact = !['SOURCE_VERIFIED', 'MANUALLY_VERIFIED'].includes(message.contact.verificationStatus);
  const policyBlocked = countryPolicy?.status !== 'ALLOWED';
  if (suppression || stale || unverifiedContact || policyBlocked || message.mailboxConnection.status !== 'CONNECTED') {
    const reason = suppression ? 'SUPPRESSED' : stale ? 'STALE_APPROVAL' : unverifiedContact ? 'CONTACT_UNVERIFIED' : policyBlocked ? 'COUNTRY_POLICY_BLOCKED' : 'MAILBOX_DISCONNECTED';
    await prisma.$transaction([
      prisma.partnerEmailMessage.update({ where: { id: message.id }, data: { status: 'CANCELLED', leaseToken: null, leaseExpiresAt: null, lastErrorCode: reason } }),
      prisma.partnerEmailEvent.create({ data: { companyAccountId: message.companyAccountId, messageId: message.id, type: 'CANCELLED', metadata: { reason } } }),
    ]);
    return 'CANCELLED';
  }
  try {
    const accessToken = await accessTokenForMailbox(message.mailboxConnection);
    const recipient = decryptedPartnerContactEmail(message.contact.encryptedEmail);
    const sent = await sendPartnerGmail({
      accessToken, to: recipient, from: message.mailboxConnection.email,
      subject: message.subjectSnapshot, body: message.bodySnapshot,
    });
    await prisma.$transaction([
      prisma.partnerEmailMessage.update({ where: { id: message.id }, data: {
        status: 'SENT', providerMessageId: sent.providerMessageId, providerThreadId: sent.providerThreadId,
        sentAt: now, leaseToken: null, leaseExpiresAt: null, lastErrorCode: null, lastErrorMessage: null,
      } }),
      prisma.partnerEmailDraft.update({ where: { id: message.draftId }, data: { status: 'SENT' } }),
      prisma.partnerOutreachApproval.update({ where: { id: message.approval!.id }, data: { status: 'CONSUMED', consumedAt: now } }),
      prisma.partnerEmailEvent.create({ data: { companyAccountId: message.companyAccountId, messageId: message.id, type: 'SENT' } }),
      prisma.partnerOrganization.update({ where: { id: message.organizationId }, data: { stage: message.organization.stage === 'DISCOVERED' ? 'CONTACTED' : message.organization.stage, lastContactedAt: now } }),
      prisma.partnerMailboxConnection.update({ where: { id: message.mailboxConnectionId }, data: { lastSuccessfulSendAt: now, lastTestedAt: now, lastErrorCode: null } }),
    ]);
    return 'SENT';
  } catch (error) {
    const status = (error as Error & { status?: number }).status ?? 500;
    const disposition = classifyPartnerEmailFailure(status);
    const retry = disposition === 'RETRY' && message.attemptCount < message.maxAttempts;
    const nextAttemptAt = nextPartnerEmailRetryAt(now, message.attemptCount);
    await prisma.$transaction([
      prisma.partnerEmailMessage.update({ where: { id: message.id }, data: {
        status: retry ? 'RETRY' : 'FAILED', nextAttemptAt, failedAt: retry ? null : now,
        leaseToken: null, leaseExpiresAt: null, lastErrorCode: `GMAIL_${status}`,
        lastErrorMessage: error instanceof Error ? error.message.slice(0, 500) : 'Gmail gönderim hatası',
      } }),
      prisma.partnerEmailEvent.create({ data: { companyAccountId: message.companyAccountId, messageId: message.id, type: retry ? 'RETRY_SCHEDULED' : 'FAILED', metadata: { status, nextAttemptAt: retry ? nextAttemptAt.toISOString() : null } } }),
      prisma.partnerMailboxConnection.update({ where: { id: message.mailboxConnectionId }, data: { lastErrorCode: `GMAIL_${status}`, lastErrorAt: now, ...(status === 401 || status === 403 ? { status: 'ERROR' } : {}) } }),
    ]);
    return retry ? 'RETRY' : 'FAILED';
  }
}

export async function processPartnerEmailOutbox(input: { now?: Date; limit?: number } = {}) {
  const now = input.now ?? new Date();
  const results: string[] = [];
  for (let index = 0; index < Math.min(25, Math.max(1, input.limit ?? 10)); index += 1) {
    const claim = await claimMessage(now);
    if (!claim) break;
    results.push(await processClaim(claim, now));
  }
  return { processed: results.length, results };
}
