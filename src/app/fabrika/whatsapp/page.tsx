import { requireFabrikaOwner } from '@/lib/fabrika-session';
import WhatsAppConnectionPanel from '@/components/fabrika/WhatsAppConnectionPanel';

export default async function WhatsAppSettingsPage() {
  await requireFabrikaOwner();
  return <WhatsAppConnectionPanel />;
}
