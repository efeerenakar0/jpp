import PlatformAccountsDashboard from '@/components/platform-admin/PlatformAccountsDashboard';
import PlatformWebsiteIntegrations from '@/components/platform-admin/PlatformWebsiteIntegrations';
import PlatformWhatsAppOverview from '@/components/platform-admin/PlatformWhatsAppOverview';
import PlatformWebsiteProjects from '@/components/platform-admin/PlatformWebsiteProjects';
import PlatformPartnerOperations from '@/components/platform-admin/PlatformPartnerOperations';

export default function PlatformAdminPage() {
  return (
    <>
      <PlatformWhatsAppOverview />
      <PlatformPartnerOperations />
      <PlatformWebsiteProjects />
      <PlatformAccountsDashboard />
      <PlatformWebsiteIntegrations />
    </>
  );
}
