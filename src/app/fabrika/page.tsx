import BusinessCeoDashboard from '@/components/fabrika/business-ceo/BusinessCeoDashboard';
import { parsePortfolioWorkflowSearchParams } from '@/lib/portfolio-workflow-intent';

export default async function FabrikaPage({
  searchParams,
}: {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
}) {
  const initialWorkflowIntent = parsePortfolioWorkflowSearchParams(
    await searchParams
  );
  return (
    <BusinessCeoDashboard initialWorkflowIntent={initialWorkflowIntent} />
  );
}
