import { notFound } from 'next/navigation';
import { LocalAvciPreview } from './LocalAvciPreview';

export const metadata = {
  title: 'AI Portföy Uzmanı Yerel Önizleme',
};

export default function LocalAvciPreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <LocalAvciPreview />;
}
