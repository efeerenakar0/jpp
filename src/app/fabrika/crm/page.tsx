import WorkspacePage from '@/components/fabrika/WorkspacePage';

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <WorkspacePage
      initialView={view === 'pipeline' ? 'pipeline' : 'customers'}
      mode="crm"
    />
  );
}
