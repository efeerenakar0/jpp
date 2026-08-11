import WorkspacePage from '@/components/fabrika/WorkspacePage';

export default async function PortfoylerPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; propertyId?: string; media?: string }>;
}) {
  const { view, propertyId, media } = await searchParams;
  return (
    <WorkspacePage
      initialOpenMedia={media === '1'}
      initialPropertyId={propertyId}
      initialView={
        view === 'malik-raporlari'
          ? 'owner-reports'
          : view === 'kaynaklar'
            ? 'sources'
            : 'properties'
      }
      mode="portfoyler"
    />
  );
}
