import { notFound } from 'next/navigation';

import StudioPage from '@/app/fabrika/studyo/page';

export const metadata = {
  title: 'Stüdyo Yerel Önizleme',
};

export default function LocalStudioPreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <StudioPage />;
}
