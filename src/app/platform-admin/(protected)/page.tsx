import PlatformAccountsDashboard from '@/components/platform-admin/PlatformAccountsDashboard';
import PlatformWebsiteIntegrations from '@/components/platform-admin/PlatformWebsiteIntegrations';
import PlatformWhatsAppOverview from '@/components/platform-admin/PlatformWhatsAppOverview';

export default function PlatformAdminPage() {
  return (
    <>
      <PlatformWhatsAppOverview />
      <PlatformAccountsDashboard />
      <PlatformWebsiteIntegrations />
    </>
  );
}
