import CrmWorkspace from '@/components/fabrika/crm/CrmWorkspace';
import type { CrmSection } from '@/components/fabrika/crm/crm-types';

export default async function CrmPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>;
}) {
  const { view } = await searchParams;
  const allowedSections: CrmSection[] = [
    'overview',
    'customers',
    'pipeline',
    'tasks',
    'finance',
    'insights',
  ];
  const initialSection = allowedSections.includes(view as CrmSection)
    ? (view as CrmSection)
    : 'overview';

  return <CrmWorkspace initialSection={initialSection} />;
}
