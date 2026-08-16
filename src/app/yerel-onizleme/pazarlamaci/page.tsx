import { notFound } from 'next/navigation';
import {
  MarketingWorkspace,
  type MarketingData,
} from '@/components/fabrika/MarketingWorkspace';

export const metadata = {
  title: 'AI Pazarlama Uzmanı Yerel Önizleme',
};

const previewData: MarketingData = {
  company: { name: 'Jasmine Group' },
  ai: { managedByPlatform: true, ready: true },
  properties: [
    {
      id: 'preview-property-1',
      title: 'Deniz manzaralı 3+1 daire',
      location: 'Alanya, Kestel',
      price: 8_500_000,
      imageUrl: null,
      referenceCode: 'JG-101',
      status: 'ACTIVE',
    },
    {
      id: 'preview-property-2',
      title: 'Merkezi konumda yatırımlık 1+1',
      location: 'Alanya, Mahmutlar',
      price: 4_750_000,
      imageUrl: null,
      referenceCode: 'JG-204',
      status: 'ACTIVE',
    },
  ],
  campaigns: [],
  websiteAnalyses: [],
  creativeAssets: [],
};

export default function LocalMarketingPreviewPage() {
  if (process.env.NODE_ENV !== 'development') {
    notFound();
  }

  return <MarketingWorkspace initialData={previewData} loadRemote={false} />;
}
