import { redirect } from 'next/navigation';
import {
  FabrikaSessionError,
  requireFabrikaPrincipal,
} from '@/lib/fabrika-session';
import { listPartners } from '@/lib/partner-outreach/service';
import { getPartnerIdFromSearchParams } from '@/lib/partner-network-view';
import PartnerNetworkClient from '@/components/fabrika/PartnerNetworkClient';

export const dynamic = 'force-dynamic';

async function loadPage() {
  let principal: Awaited<ReturnType<typeof requireFabrikaPrincipal>>;

  try {
    principal = await requireFabrikaPrincipal();
  } catch (error) {
    if (error instanceof FabrikaSessionError) redirect('/fabrika-giris');

    return {
      partners: [],
      owner: false,
      error: 'Oturum bilgileri şu anda kontrol edilemiyor. Lütfen kısa bir süre sonra yeniden deneyin.',
    };
  }

  try {
    const partners = await listPartners(principal.account.id, {});
    return {
      partners: JSON.parse(JSON.stringify(partners)),
      owner: principal.type === 'OWNER',
      error: null,
    };
  } catch {
    return {
      partners: [],
      owner: principal.type === 'OWNER',
      error: 'Partner ağı verileri şu anda yüklenemedi. Lütfen sayfayı yenileyin.',
    };
  }
}

export default async function PartnerNetworkPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const data = await loadPage();
  const initialPartnerId = getPartnerIdFromSearchParams(await searchParams);

  return (
    <PartnerNetworkClient
      initialPartners={data.partners}
      owner={data.owner}
      initialPartnerId={initialPartnerId}
      initialError={data.error}
    />
  );
}
