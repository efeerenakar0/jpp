import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Platform Yönetimi | Jasmine AI',
  description:
    'Jasmine AI şirket hesapları, erişim ve abonelik yönetim paneli.',
};

export default function PlatformAdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
