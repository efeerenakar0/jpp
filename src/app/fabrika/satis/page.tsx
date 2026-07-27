import { redirect } from 'next/navigation';

export default function SatisPage() {
  redirect('/fabrika/crm?view=pipeline');
}
