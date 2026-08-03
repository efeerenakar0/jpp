import { NextResponse } from 'next/server';
import { NotificationType, PartnerSourceType, Prisma } from '@prisma/client';
import { z } from 'zod';
import prisma from '@/lib/prisma';
import { createCompanyNotification } from '@/lib/fabrika-notifications';
import { emailSuppressionHmac, encryptPartnerCredential, maskPartnerEmail, partnerSecurityHmac } from '@/lib/partner-outreach/crypto';
import { normalizeDomain, normalizePartnerEmail } from '@/lib/partner-outreach/normalization';

const applicationSchema = z.object({
  companyName: z.string().trim().min(2).max(200),
  contactName: z.string().trim().min(2).max(160),
  email: z.string().trim().email().max(320),
  phone: z.string().trim().min(7).max(40),
  country: z.string().trim().min(2).max(120),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  city: z.string().trim().min(2).max(120),
  websiteUrl: z.string().trim().url().max(2_000).optional().or(z.literal('')),
  languages: z.array(z.string().trim().min(2).max(40)).max(15),
  specialties: z.array(z.string().trim().min(2).max(100)).max(20),
  licenseNumber: z.string().trim().max(160).optional(),
  partnerType: z.enum(['REFERRAL', 'SALES', 'PROJECT', 'OTHER']),
  message: z.string().trim().max(3000).optional(),
  privacyConsent: z.literal(true),
  websiteFax: z.string().max(0).optional(),
});

async function publicCompany() {
  const slug = process.env.PARTNER_PUBLIC_COMPANY_SLUG?.trim();
  if (!slug) return null;
  return prisma.companyAccount.findFirst({ where: { slug, status: 'ACTIVE', workspaceEnabled: true }, select: { id: true } });
}

export async function POST(request: Request) {
  try {
    const parsed = applicationSchema.safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ success: false, error: 'Başvuru bilgilerini kontrol edin.' }, { status: 400 });
    const input = parsed.data;
    const account = await publicCompany();
    if (!account) return NextResponse.json({ success: false, error: 'Partner başvuru kanalı şu anda yapılandırılmamış.' }, { status: 503 });
    const email = normalizePartnerEmail(input.email)!;
    const emailHmac = emailSuppressionHmac(email);
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const fingerprint = partnerSecurityHmac('partner-application', `${ip}|${request.headers.get('user-agent') || ''}`);
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const recent = await prisma.partnerApplicationAttempt.count({ where: { companyAccountId: account.id, fingerprintHmac: fingerprint, createdAt: { gte: since } } });
    if (recent >= 5) {
      await prisma.partnerApplicationAttempt.create({ data: { companyAccountId: account.id, fingerprintHmac: fingerprint, emailHmac, accepted: false, reasonCode: 'RATE_LIMIT' } });
      return NextResponse.json({ success: false, error: 'Çok fazla başvuru denemesi yapıldı. Lütfen daha sonra tekrar deneyin.' }, { status: 429 });
    }
    if (input.websiteFax) {
      await prisma.partnerApplicationAttempt.create({ data: { companyAccountId: account.id, fingerprintHmac: fingerprint, emailHmac, accepted: false, reasonCode: 'HONEYPOT' } });
      return NextResponse.json({ success: true, message: 'Başvurunuz alındı.' });
    }
    const duplicate = await prisma.partnerContact.findUnique({ where: { companyAccountId_emailHmac: { companyAccountId: account.id, emailHmac } } });
    if (duplicate) {
      await prisma.partnerApplicationAttempt.create({ data: { companyAccountId: account.id, fingerprintHmac: fingerprint, emailHmac, accepted: false, reasonCode: 'DUPLICATE' } });
      return NextResponse.json({ success: true, message: 'Başvurunuz değerlendirme kuyruğuna alındı.' });
    }
    const organizationId = await prisma.$transaction(async (tx) => {
      const normalizedName = input.companyName.toLocaleLowerCase('en-US').replace(/[^\p{L}\p{N}]+/gu, '');
      const domain = normalizeDomain(input.websiteUrl);
      const existing = await tx.partnerOrganization.findFirst({ where: { companyAccountId: account.id, OR: [
        ...(domain ? [{ domain }] : []), { normalizedName, city: input.city },
      ] } });
      const organization = existing || await tx.partnerOrganization.create({ data: {
        companyAccountId: account.id, legalName: input.companyName, displayName: input.companyName,
        normalizedName, domain, websiteUrl: input.websiteUrl || null,
        countryCode: input.countryCode, countryName: input.country, city: input.city,
        licenseNumber: input.licenseNumber || null, languages: input.languages, specialties: input.specialties,
        stage: 'DISCOVERED', confidenceScore: 30,
      } });
      const evidence = { submitted: { companyName: input.companyName, contactName: input.contactName, country: input.country, city: input.city, websiteUrl: input.websiteUrl || null, languages: input.languages, specialties: input.specialties, licenseNumber: input.licenseNumber || null, partnerType: input.partnerType, message: input.message || null, phoneProvided: Boolean(input.phone), privacyConsent: true } };
      const source = await tx.partnerSource.create({ data: {
        companyAccountId: account.id, organizationId: organization.id,
        type: PartnerSourceType.FIRST_PARTY_APPLICATION, providerKey: 'public_application',
        sourceUrl: input.websiteUrl || null, title: `${input.companyName} iş ortaklığı başvurusu`,
        evidence: evidence as Prisma.InputJsonValue, contentHash: partnerSecurityHmac('application-content', JSON.stringify(evidence)),
        observedAt: new Date(), trusted: false,
      } });
      await tx.partnerContact.create({ data: {
        companyAccountId: account.id, organizationId: organization.id, role: 'APPLICATION_CONTACT', name: input.contactName,
        encryptedEmail: encryptPartnerCredential(email), emailHmac, emailMasked: maskPartnerEmail(email),
        emailDomain: email.split('@')[1], encryptedPhone: encryptPartnerCredential(input.phone),
        phoneMasked: input.phone.replace(/.(?=.{4})/g, '*'), verificationStatus: 'UNVERIFIED', sourceId: source.id,
      } });
      await tx.partnerActivity.create({ data: { companyAccountId: account.id, organizationId: organization.id, type: 'APPLICATION_RECEIVED', actorType: 'PUBLIC_APPLICANT', summary: 'Yeni iş ortaklığı başvurusu alındı.', metadata: { partnerType: input.partnerType } } });
      await tx.partnerApplicationAttempt.create({ data: { companyAccountId: account.id, fingerprintHmac: fingerprint, emailHmac, accepted: true } });
      return organization.id;
    });
    await createCompanyNotification({ companyAccountId: account.id, type: NotificationType.SYSTEM, title: 'Yeni partner başvurusu', message: `${input.companyName} için yeni iş ortaklığı başvurusu alındı.`, link: `/fabrika/partnerler?partner=${organizationId}`, important: true, dedupeKey: `partner-application:${organizationId}` });
    return NextResponse.json({ success: true, message: 'Başvurunuz değerlendirme kuyruğuna alındı.' }, { status: 201 });
  } catch (error) {
    console.error('Partner application failed', { name: error instanceof Error ? error.name : 'UnknownError' });
    return NextResponse.json({ success: false, error: 'Başvuru şu anda alınamadı. Lütfen daha sonra tekrar deneyin.' }, { status: 500 });
  }
}
