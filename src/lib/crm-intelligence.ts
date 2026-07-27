import { callAI } from './ai';

export type CrmScoreInput = {
  type: string;
  stage: string;
  source: string | null;
  desiredLocation: string | null;
  desiredRoomCount: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  notes: string | null;
  tags: string[];
  nextActionAt: Date | null;
  updatedAt: Date;
  deals: Array<{ stage: string; probability: number; estimatedValue: number | null }>;
  tasks: Array<{ status: string; priority: number; dueAt: Date | null }>;
  activities: Array<{ type: string; createdAt: Date }>;
};

export type CrmScoreResult = {
  score: number;
  reasons: string[];
  source: 'AI' | 'RULES';
};

function clampScore(score: number) {
  return Math.max(5, Math.min(99, Math.round(score)));
}

export function calculateRuleBasedCrmScore(input: CrmScoreInput): CrmScoreResult {
  let score = 30;
  const reasons: string[] = [];
  const stageBoost: Record<string, number> = {
    NEW: 0,
    CONTACTED: 8,
    QUALIFIED: 18,
    VIEWING: 25,
    OFFER: 35,
    WON: 45,
    LOST: -30,
  };

  score += stageBoost[input.stage] ?? 0;
  if (['QUALIFIED', 'VIEWING', 'OFFER', 'WON'].includes(input.stage)) {
    reasons.push('Satış sürecinde güçlü bir aşamada');
  } else if (input.stage === 'LOST') {
    reasons.push('Satış süreci kaybedildi olarak işaretli');
  }

  const preferenceCount = [
    input.desiredLocation,
    input.desiredRoomCount,
    input.budgetMin,
    input.budgetMax,
  ].filter((value) => value != null && value !== '').length;
  if (preferenceCount >= 3) {
    score += 12;
    reasons.push('Arama kriterleri ayrıntılı');
  } else if (preferenceCount > 0) {
    score += 5;
    reasons.push('Bazı portföy tercihleri tanımlı');
  }

  const highestDealProbability = Math.max(
    0,
    ...input.deals.map((deal) => deal.probability)
  );
  if (highestDealProbability >= 70) {
    score += 18;
    reasons.push(`Açık fırsat olasılığı %${highestDealProbability}`);
  } else if (highestDealProbability >= 40) {
    score += 9;
    reasons.push(`Satış fırsatı olasılığı %${highestDealProbability}`);
  }

  const openHighPriorityTasks = input.tasks.filter(
    (task) => task.status === 'OPEN' && task.priority === 3
  ).length;
  if (openHighPriorityTasks > 0) {
    score += 5;
    reasons.push(`${openHighPriorityTasks} yüksek öncelikli takip açık`);
  }

  const recentActivity = input.activities.some(
    (activity) =>
      Date.now() - activity.createdAt.getTime() <= 14 * 24 * 60 * 60 * 1000
  );
  if (recentActivity) {
    score += 8;
    reasons.push('Son 14 günde etkileşim kaydı var');
  } else if (input.activities.length === 0) {
    score -= 8;
    reasons.push('Henüz etkileşim kaydı yok');
  }

  if (input.nextActionAt) {
    score += 5;
    reasons.push('Sonraki takip zamanı planlandı');
  }

  if (reasons.length === 0) {
    reasons.push('Puan mevcut profil bilgilerinden hesaplandı');
  }

  return {
    score: clampScore(score),
    reasons: reasons.slice(0, 5),
    source: 'RULES',
  };
}

function parseAiScore(content: string): Pick<CrmScoreResult, 'score' | 'reasons'> | null {
  try {
    const match = content.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match?.[0] || content) as {
      score?: unknown;
      reasons?: unknown;
    };
    if (
      typeof parsed.score !== 'number' ||
      !Array.isArray(parsed.reasons) ||
      parsed.reasons.length === 0
    ) {
      return null;
    }
    const reasons = parsed.reasons
      .filter((reason): reason is string => typeof reason === 'string')
      .map((reason) => reason.trim())
      .filter(Boolean)
      .slice(0, 5);
    if (reasons.length === 0) return null;
    return { score: clampScore(parsed.score), reasons };
  } catch {
    return null;
  }
}

export async function calculateCrmScore(input: CrmScoreInput): Promise<CrmScoreResult> {
  const fallback = calculateRuleBasedCrmScore(input);
  const safeInput = {
    type: input.type,
    stage: input.stage,
    source: input.source,
    preferences: {
      location: input.desiredLocation,
      roomCount: input.desiredRoomCount,
      budgetMin: input.budgetMin,
      budgetMax: input.budgetMax,
    },
    notes: input.notes?.slice(0, 1200) || null,
    tags: input.tags.slice(0, 12),
    nextActionAt: input.nextActionAt,
    deals: input.deals,
    tasks: input.tasks,
    recentActivityTypes: input.activities.slice(0, 20).map((activity) => activity.type),
    ruleBasedReference: fallback,
  };

  try {
    const response = await callAI(
      [
        {
          role: 'system',
          content:
            'Sen emlak CRM müşteri önceliklendirme uzmanısın. Yalnızca verilen gerçek verilere dayan. 5-99 arasında tam sayı score ve Türkçe 2-5 kısa reasons üret. Kişisel bilgi uydurma. Sadece geçerli JSON döndür: {"score":75,"reasons":["..."]}.',
        },
        {
          role: 'user',
          content: JSON.stringify(safeInput),
        },
      ],
      'crm-score'
    );
    const parsed = parseAiScore(response.content);
    if (!parsed) return fallback;
    return { ...parsed, source: 'AI' };
  } catch {
    return fallback;
  }
}
