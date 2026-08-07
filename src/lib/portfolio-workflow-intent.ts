import {
  EXECUTIVE_WORKFLOW_STEPS,
  resolveExecutiveWorkflowEntryStep,
  type ExecutivePortfolioDraft,
  type ExecutiveWorkflowSource,
  type ExecutiveWorkflowStep,
} from './executive-portfolio-workflow';

export const PORTFOLIO_WORKFLOW_INTENT_STORAGE_KEY =
  'business-ceo:portfolio-workflow-intent';

export type PortfolioWorkflowLaunchIntent = {
  source?: ExecutiveWorkflowSource;
  step?: ExecutiveWorkflowStep;
  resume?: boolean;
  requestedAt?: string;
};

export type ResolvedPortfolioWorkflowLaunch = {
  source: ExecutiveWorkflowSource;
  step: ExecutiveWorkflowStep;
};

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function isWorkflowSource(value: unknown): value is ExecutiveWorkflowSource {
  return value === 'hunter' || value === 'studio';
}

function isWorkflowStep(value: unknown): value is ExecutiveWorkflowStep {
  return (
    typeof value === 'string' &&
    EXECUTIVE_WORKFLOW_STEPS.includes(value as ExecutiveWorkflowStep)
  );
}

function isTruthy(value: unknown) {
  return value === true || value === '1' || value === 'true';
}

export function parsePortfolioWorkflowSearchParams(
  searchParams: SearchParams
): PortfolioWorkflowLaunchIntent | null {
  if (first(searchParams.workflow) !== 'portfolio') return null;

  const sourceValue = first(searchParams.entry) ?? first(searchParams.source);
  const stepValue = first(searchParams.step);
  return {
    ...(isWorkflowSource(sourceValue) ? { source: sourceValue } : {}),
    ...(isWorkflowStep(stepValue) ? { step: stepValue } : {}),
    resume: isTruthy(first(searchParams.resume)),
  };
}

export function parseStoredPortfolioWorkflowIntent(
  value: string | null
): PortfolioWorkflowLaunchIntent | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return null;
    const source = isWorkflowSource(parsed.source) ? parsed.source : undefined;
    const step = isWorkflowStep(parsed.step) ? parsed.step : undefined;
    const requestedAt =
      typeof parsed.requestedAt === 'string' ? parsed.requestedAt : undefined;
    return {
      ...(source ? { source } : {}),
      ...(step ? { step } : {}),
      resume: isTruthy(parsed.resume),
      ...(requestedAt ? { requestedAt } : {}),
    };
  } catch {
    return null;
  }
}

export function buildPortfolioWorkflowHref(
  intent: PortfolioWorkflowLaunchIntent = { resume: true }
) {
  const searchParams = new URLSearchParams({ workflow: 'portfolio' });
  if (intent.source) searchParams.set('entry', intent.source);
  if (intent.step) searchParams.set('step', intent.step);
  if (intent.resume) searchParams.set('resume', '1');
  return `/fabrika?${searchParams.toString()}`;
}

export function resolvePortfolioWorkflowLaunch(
  draft: ExecutivePortfolioDraft,
  intent: PortfolioWorkflowLaunchIntent
): ResolvedPortfolioWorkflowLaunch {
  const source = intent.source ?? draft.source ?? 'studio';
  const requestedStep =
    intent.resume && draft.source
      ? draft.currentStep
      : intent.step ?? 'source';
  return {
    source,
    step: resolveExecutiveWorkflowEntryStep(draft, requestedStep),
  };
}
