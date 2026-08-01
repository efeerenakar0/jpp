import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Yönetimi | Business CEO AI',
  description:
    'Business CEO AI şirket hesapları, erişim ve abonelik yönetim paneli.',
};

export default function PlatformAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
