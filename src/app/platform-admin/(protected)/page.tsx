import PlatformAccountsDashboard from '@/components/platform-admin/PlatformAccountsDashboard';
import PlatformWhatsAppOverview from '@/components/platform-admin/PlatformWhatsAppOverview';

export default function PlatformAdminPage() {
  return (
    <>
      <PlatformWhatsAppOverview />
      <PlatformAccountsDashboard />
    </>
  );
}
