import PlatformAccountsDashboard from '@/components/platform-admin/PlatformAccountsDashboard';
import PlatformWhatsAppOverview from '@/components/platform-admin/PlatformWhatsAppOverview';
import PlatformWebsiteProjects from '@/components/platform-admin/PlatformWebsiteProjects';

export default function PlatformAdminPage() {
  return (
    <>
      <PlatformWhatsAppOverview />
      <PlatformWebsiteProjects />
      <PlatformAccountsDashboard />
    </>
  );
}
