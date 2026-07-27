import WorkspacePage from '@/components/fabrika/WorkspacePage';

export default async function PortfoylerPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  return (
    <WorkspacePage
      initialView={
        view === 'malik-raporlari' ? 'owner-reports' : 'properties'
      }
      mode="portfoyler"
    />
  );
}
