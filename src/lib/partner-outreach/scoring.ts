import { PARTNER_SCORE_VERSION } from './types';

type ScoreInput = {
  targetFit: number | null;
  internationalFit: number | null;
  legalVerification: number | null;
  reviewAverage: number | null;
  reviewCount: number | null;
  activityAt: Date | null;
  corporateContactVerified: boolean;
  evidenceCoverage: number;
  now: Date;
};

function unit(value: number | null | undefined) {
  if (value == null || !Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function rounded(value: number) {
  return Math.round(value * 100) / 100;
}

function reputationScore(average: number | null, count: number | null) {
  if (average == null || count == null || count <= 0) return 0;
  const boundedAverage = Math.min(5, Math.max(0, average));
  const priorAverage = 3.8;
  const priorWeight = 20;
  const bayesian =
    (boundedAverage * count + priorAverage * priorWeight) /
    (count + priorWeight);
  return rounded((bayesian / 5) * 15);
}

function freshnessScore(activityAt: Date | null, now: Date) {
  if (!activityAt || activityAt.getTime() > now.getTime()) return 0;
  const ageDays =
    (now.getTime() - activityAt.getTime()) / (24 * 60 * 60 * 1000);
  if (ageDays <= 30) return 10;
  if (ageDays <= 90) return 8;
  if (ageDays <= 180) return 5;
  if (ageDays <= 365) return 2;
  return 0;
}

export function scorePartnerCandidate(input: ScoreInput) {
  const breakdown = {
    targetFit: rounded(unit(input.targetFit) * 25),
    internationalFit: rounded(unit(input.internationalFit) * 20),
    legalVerification: rounded(unit(input.legalVerification) * 20),
    reputation: reputationScore(input.reviewAverage, input.reviewCount),
    freshness: freshnessScore(input.activityAt, input.now),
    corporateContact: input.corporateContactVerified ? 10 : 0,
  };
  const total = rounded(
    Object.values(breakdown).reduce((sum, value) => sum + value, 0)
  );
  const confidence = Math.round(unit(input.evidenceCoverage) * 100);
  return {
    version: PARTNER_SCORE_VERSION,
    total,
    confidence,
    breakdown,
    explanations: [
      `Hedef ve portföy uyumu: ${breakdown.targetFit}/25`,
      `Uluslararası deneyim ve dil uyumu: ${breakdown.internationalFit}/20`,
      `Yasal kayıt ve lisans doğrulaması: ${breakdown.legalVerification}/20`,
      `Bayes düzeltmeli itibar: ${breakdown.reputation}/15`,
      `Kaynak güncelliği: ${breakdown.freshness}/10`,
      `Doğrulanmış kurumsal iletişim: ${breakdown.corporateContact}/10`,
      `Kanıt kapsamı: %${confidence}`,
    ],
  };
}
