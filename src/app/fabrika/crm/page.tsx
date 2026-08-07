import CompanyCeoWorkspace from '@/components/fabrika/CompanyCeoWorkspace';

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <CompanyCeoWorkspace
      initialSection={
        view === 'pipeline'
          ? 'pipeline'
          : view === 'customers'
            ? 'customers'
            : 'overview'
      }
    />
  );
}
