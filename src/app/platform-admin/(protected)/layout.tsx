import { redirect } from 'next/navigation';
import { requirePlatformAdmin } from '@/lib/require-platform-admin';

export default async function PlatformAdminProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePlatformAdmin();

  if (!session) {
    redirect('/platform-admin/giris');
  }

  return children;
}
