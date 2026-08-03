import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { partnerApiError } from '@/lib/partner-outreach/api';
import { scorePartnerCandidate } from '@/lib/partner-outreach/scoring';

export async function POST(_request: Request, context: { params: Promise<{ partnerId: string }> }) {
  try {
    const principal = await requireFabrikaPrincipal();
    const { partnerId } = await context.params;
    const partner = await prisma.partnerOrganization.findFirst({ where: { id: partnerId, companyAccountId: principal.account.id }, include: { contacts: true, sources: true } });
    if (!partner) throw new Error('Partner kaydı bulunamadı.');
    const score = scorePartnerCandidate({
      targetFit: partner.specialties.length ? 0.8 : null,
      internationalFit: partner.internationalExperience || partner.languages.length > 1 ? 0.8 : null,
      legalVerification: partner.licenseVerifiedAt ? 1 : partner.licenseNumber || partner.registrationNumber ? 0.6 : null,
      reviewAverage: partner.reviewAverage, reviewCount: partner.reviewCount,
      activityAt: partner.lastVerifiedAt || partner.lastEnrichedAt,
      corporateContactVerified: partner.contacts.some((contact) => ['SOURCE_VERIFIED', 'MANUALLY_VERIFIED'].includes(contact.verificationStatus)),
      evidenceCoverage: Math.min(1, partner.sources.length / 5), now: new Date(),
    });
    await prisma.$transaction([
      prisma.partnerOrganization.update({ where: { id: partner.id }, data: { fitScore: score.total, confidenceScore: score.confidence, scoreExplanation: score.breakdown } }),
      prisma.partnerScoreSnapshot.create({ data: { companyAccountId: principal.account.id, organizationId: partner.id, version: score.version, total: score.total, confidence: score.confidence, breakdown: score.breakdown, explanations: score.explanations, evidenceSourceIds: partner.sources.map((source) => source.id) } }),
    ]);
    return NextResponse.json({ success: true, score });
  } catch (error) { return partnerApiError(error); }
}
