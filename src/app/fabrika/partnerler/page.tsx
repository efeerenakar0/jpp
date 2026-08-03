import { redirect } from 'next/navigation';
import { requireFabrikaPrincipal } from '@/lib/fabrika-session';
import { listPartners } from '@/lib/partner-outreach/service';
import PartnerNetworkClient from '@/components/fabrika/PartnerNetworkClient';

export const dynamic = 'force-dynamic';

async function loadPage() {
  try {
    const principal = await requireFabrikaPrincipal();
    const partners = await listPartners(principal.account.id, {});
    return { partners: JSON.parse(JSON.stringify(partners)), owner: principal.type === 'OWNER' };
  } catch {
    redirect('/fabrika-giris');
  }
}

export default async function PartnerNetworkPage() {
  const data = await loadPage();
  return <PartnerNetworkClient initialPartners={data.partners} owner={data.owner} />;
}
