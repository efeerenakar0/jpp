import { MessageCircle } from 'lucide-react';
import WhatsAppConnectionPanel from '@/components/fabrika/WhatsAppConnectionPanel';
import { requireFabrikaOwner } from '@/lib/fabrika-session';

export default async function WhatsAppSettingsPage() {
  await requireFabrikaOwner();

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <header className="border-b border-slate-800 pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">
          Telefon ve otomasyon
        </p>
        <div className="mt-3 flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400">
            <MessageCircle className="size-5" aria-hidden="true" />
          </span>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-50 sm:text-3xl">
              WhatsApp bağlantısı
            </h1>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-slate-400">
              Şirket telefonunuzu bağlayın. Bağlantı kurulduğunda gelen
              konuşmalar Asistan ve izin verilen Avcı akışlarında aynı şirket
              hesabıyla çalışır.
            </p>
          </div>
        </div>
      </header>

      <section id="telefon-baglantisi" aria-label="WhatsApp telefon bağlantısı">
        <WhatsAppConnectionPanel />
      </section>
    </main>
  );
}
