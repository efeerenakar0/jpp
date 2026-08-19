import { z } from "zod";

const performanceSchema = z.object({
  completedTasks: z.number().int().nonnegative(),
  openTasks: z.number().int().nonnegative(),
  wonDeals: z.number().int().nonnegative(),
  newProperties: z.number().int().nonnegative(),
});

const companyCeoDealSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    stage: z.string(),
    estimatedValue: z.number().nonnegative().nullish(),
    commissionRate: z.number().min(0).max(100).nullish(),
    probability: z.number().min(0).max(100).nullish(),
    expectedCloseAt: z.coerce.date().nullish(),
  })
  .passthrough();

export const companyCeoWorkspaceSchema = z
  .object({
    metrics: z.object({
      contacts: z.number().int().nonnegative(),
      activeProperties: z.number().int().nonnegative(),
      openDeals: z.number().int().nonnegative(),
      overdueTasks: z.number().int().nonnegative(),
      upcomingCriticalTasks: z.number().int().nonnegative(),
      pipelineValue: z.number().nonnegative(),
      wonCommission: z.number().nonnegative(),
      averageMatchScore: z.number().nonnegative(),
    }),
    members: z.array(
      z
        .object({
          id: z.string(),
          name: z.string(),
          active: z.boolean(),
          monthlyPerformance: performanceSchema,
        })
        .passthrough(),
    ),
    deals: z.array(companyCeoDealSchema).optional(),
    tasks: z.array(z.object({ id: z.string() }).passthrough()),
  })
  .passthrough();

export const companyCeoManagerSchema = z
  .object({
    approvals: z.array(
      z.object({ id: z.string(), reason: z.string().nullish() }).passthrough(),
    ),
    commitments: z.array(
      z
        .object({
          id: z.string(),
          status: z.string(),
          description: z.string(),
        })
        .passthrough(),
    ),
    deliveries: z.array(
      z
        .object({
          id: z.string(),
          status: z.string(),
          purpose: z.string().nullish(),
        })
        .passthrough(),
    ),
    summary: z.object({ generatedText: z.string() }).passthrough().nullish(),
  })
  .passthrough();

export const companyCeoCampaignSchema = z
  .object({
    id: z.string(),
    publicationStatus: z.string().nullish(),
  })
  .passthrough();

export const companyCeoMarketingSchema = z
  .object({
    campaigns: z.array(companyCeoCampaignSchema),
  })
  .passthrough();

export type CompanyCeoWorkspace = z.infer<typeof companyCeoWorkspaceSchema>;
export type CompanyCeoManager = z.infer<typeof companyCeoManagerSchema>;
export type CompanyCeoCampaign = z.infer<typeof companyCeoCampaignSchema>;
export type CompanyCeoDeal = z.infer<typeof companyCeoDealSchema>;

export type CompanyCeoCriticalAlert = {
  id: string;
  kind: "DELIVERY_FAILED" | "COMMITMENT_OVERDUE" | "APPROVAL" | "OVERDUE_TASKS";
  title: string;
  detail: string;
};

const CLOSED_DEAL_STAGES = new Set(["WON", "LOST"]);
const THIRTY_DAYS_IN_MS = 30 * 24 * 60 * 60 * 1000;

const PIPELINE_STAGE_GROUPS = [
  { key: "new", label: "Yeni", stages: ["NEW", "CONTACTED"] },
  { key: "qualified", label: "Nitelikli", stages: ["QUALIFIED"] },
  { key: "matched", label: "Eşleşti", stages: ["MATCHED"] },
  { key: "viewing", label: "Gösterim", stages: ["VIEWING"] },
  { key: "closing", label: "Teklif / sözleşme", stages: ["OFFER", "CONTRACT"] },
] as const;

function calculateWeightedCommission(
  deal: CompanyCeoDeal,
  probabilityAdjustment = 0,
) {
  const commission =
    (deal.estimatedValue || 0) * ((deal.commissionRate || 0) / 100);
  const probability = Math.min(
    100,
    Math.max(0, (deal.probability || 0) + probabilityAdjustment),
  );
  return commission * (probability / 100);
}

export function buildThirtyDayOutlook(
  deals: readonly CompanyCeoDeal[],
  now = new Date(),
) {
  const windowEnd = new Date(now.getTime() + THIRTY_DAYS_IN_MS);
  const openDeals = deals.filter((deal) => !CLOSED_DEAL_STAGES.has(deal.stage));
  const eligibleDeals = openDeals.filter((deal) => {
    if (!deal.expectedCloseAt) return false;
    const expectedCloseAt = deal.expectedCloseAt.getTime();
    return (
      expectedCloseAt >= now.getTime() &&
      expectedCloseAt <= windowEnd.getTime() &&
      (deal.estimatedValue || 0) > 0 &&
      (deal.commissionRate || 0) > 0 &&
      deal.probability != null
    );
  });
  const dataCoverage = openDeals.length
    ? Math.round((eligibleDeals.length / openDeals.length) * 100)
    : 0;
  const expectedCommission = eligibleDeals.reduce(
    (sum, deal) => sum + calculateWeightedCommission(deal),
    0,
  );
  const conservativeCommission = eligibleDeals.reduce(
    (sum, deal) => sum + calculateWeightedCommission(deal, -15),
    0,
  );
  const optimisticCommission = eligibleDeals.reduce(
    (sum, deal) => sum + calculateWeightedCommission(deal, 15),
    0,
  );

  const confidence =
    eligibleDeals.length >= 10 && dataCoverage >= 70
      ? "high"
      : eligibleDeals.length >= 4 && dataCoverage >= 50
        ? "medium"
        : "low";

  return {
    status: eligibleDeals.length > 0 ? "available" : "insufficient_data",
    windowStart: now.toISOString(),
    windowEnd: windowEnd.toISOString(),
    openDealCount: openDeals.length,
    eligibleDealCount: eligibleDeals.length,
    dataCoverage,
    confidence,
    expectedCommission,
    conservativeCommission,
    optimisticCommission,
    missingExpectedCloseAt: openDeals.filter((deal) => !deal.expectedCloseAt)
      .length,
    missingFinancials: openDeals.filter(
      (deal) =>
        (deal.estimatedValue || 0) <= 0 || (deal.commissionRate || 0) <= 0,
    ).length,
    topOpportunities: eligibleDeals
      .map((deal) => ({
        id: deal.id,
        title: deal.title,
        stage: deal.stage,
        expectedCloseAt: deal.expectedCloseAt!.toISOString(),
        weightedCommission: calculateWeightedCommission(deal),
      }))
      .sort((left, right) => right.weightedCommission - left.weightedCommission)
      .slice(0, 3),
  } as const;
}

export function buildCompanyCeoSnapshot(
  workspace: CompanyCeoWorkspace,
  manager: CompanyCeoManager,
  campaigns: CompanyCeoCampaign[],
  now = new Date(),
) {
  const criticalAlerts: CompanyCeoCriticalAlert[] = [];

  for (const delivery of manager.deliveries) {
    if (!["FAILED", "DEAD_LETTER"].includes(delivery.status)) continue;
    criticalAlerts.push({
      id: delivery.id,
      kind: "DELIVERY_FAILED",
      title: "İletişim teslim edilemedi",
      detail: delivery.purpose || "İlgili operasyon mesajını kontrol edin.",
    });
  }

  for (const commitment of manager.commitments) {
    if (commitment.status !== "OVERDUE") continue;
    criticalAlerts.push({
      id: commitment.id,
      kind: "COMMITMENT_OVERDUE",
      title: "Taahhüt gecikti",
      detail: commitment.description,
    });
  }

  for (const approval of manager.approvals) {
    criticalAlerts.push({
      id: approval.id,
      kind: "APPROVAL",
      title: "Patron onayı bekleniyor",
      detail: approval.reason || "Karar ayrıntısını inceleyin.",
    });
  }

  if (workspace.metrics.overdueTasks > 0) {
    criticalAlerts.push({
      id: `overdue-tasks:${now.toISOString().slice(0, 10)}`,
      kind: "OVERDUE_TASKS",
      title: `${workspace.metrics.overdueTasks} görev gecikti`,
      detail: "Takvim ve görev sorumlularını kontrol edin.",
    });
  }

  const employeePerformance = workspace.members
    .filter((member) => member.active)
    .map((member) => ({
      id: member.id,
      name: member.name,
      ...member.monthlyPerformance,
    }))
    .sort((left, right) => right.completedTasks - left.completedTasks);

  const manuallyConfirmedCampaigns = campaigns.filter(
    (campaign) => campaign.publicationStatus === "MANUALLY_CONFIRMED",
  ).length;
  const deals = workspace.deals || [];
  const pipelineStages = PIPELINE_STAGE_GROUPS.map((group) => ({
    key: group.key,
    label: group.label,
    count: deals.filter((deal) =>
      group.stages.some((stage) => stage === deal.stage),
    ).length,
  }));

  return {
    generatedAt: now.toISOString(),
    companyName:
      typeof workspace.account === "object" &&
      workspace.account !== null &&
      "companyName" in workspace.account &&
      typeof workspace.account.companyName === "string"
        ? workspace.account.companyName
        : null,
    metrics: {
      customers: workspace.metrics.contacts,
      portfolios: workspace.metrics.activeProperties,
      opportunities: workspace.metrics.openDeals,
      overdueTasks: workspace.metrics.overdueTasks,
      upcomingCriticalTasks: workspace.metrics.upcomingCriticalTasks,
      pipelineValue: workspace.metrics.pipelineValue,
      wonCommission: workspace.metrics.wonCommission,
      averageMatchScore: workspace.metrics.averageMatchScore,
      campaigns: campaigns.length,
      manuallyConfirmedCampaigns,
    },
    employeePerformance,
    criticalAlerts,
    pipelineStages,
    thirtyDayOutlook: buildThirtyDayOutlook(deals, now),
    report:
      manager.summary?.generatedText.trim() ||
      "Henüz doğrulanmış yönetici özeti oluşmadı.",
  };
}
