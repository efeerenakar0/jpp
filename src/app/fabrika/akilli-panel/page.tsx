import { redirect } from 'next/navigation';

import {
  buildPortfolioWorkflowHref,
  parsePortfolioWorkflowSearchParams,
} from '@/lib/portfolio-workflow-intent';

/**
 * Eski AI Akış Merkezi bağlantılarını bozmadan kanonik Business CEO AI
 * ana ekranına taşır.
 */
export default async function LegacyExecutiveDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<
    Record<string, string | string[] | undefined>
  >;
}) {
  const legacySearchParams = (await searchParams) ?? {};
  const hasExplicitIntent = ['workflow', 'entry', 'source', 'step', 'resume'].some(
    (key) => legacySearchParams[key] !== undefined
  );
  const intent = hasExplicitIntent
    ? parsePortfolioWorkflowSearchParams({
        ...legacySearchParams,
        workflow: 'portfolio',
      }) ?? { resume: true }
    : { resume: true };
  redirect(buildPortfolioWorkflowHref(intent));
}
