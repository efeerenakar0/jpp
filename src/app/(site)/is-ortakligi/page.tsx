import { CheckCircle2, Globe2, Handshake, ShieldCheck } from 'lucide-react';
import PartnerApplicationForm from '@/components/site/PartnerApplicationForm';

export default function PartnerPage() {
  return (
    <main className="min-h-screen bg-[#090d16] pt-20 text-slate-100">
      <section className="border-b border-slate-800 bg-slate-950 py-20">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-cyan-400/10 text-cyan-300"><Handshake className="h-7 w-7" /></div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Global Partner Ağı</p>
          <h1 className="text-4xl font-black tracking-tight text-white md:text-6xl">Birlikte daha fazla doğru müşteriye ulaşalım</h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-7 text-slate-400">Kurumsal emlak ofisleri ve doğrulanabilir profesyoneller için şeffaf, insan onaylı iş ortaklığı başvurusu.</p>
        </div>
      </section>
      <section className="mx-auto grid max-w-6xl gap-8 px-5 py-16 lg:grid-cols-[0.75fr_1.25fr]">
        <aside className="space-y-5">
          {[ [Globe2, 'Uluslararası erişim', 'Ülke, dil ve uzmanlık uyumuna göre doğru ortaklıklar.'], [ShieldCheck, 'Kaynaklı değerlendirme', 'İddialar doğrulanabilir kurumsal bilgilerle değerlendirilir.'], [CheckCircle2, 'İnsan onayı', 'İlk temas ve ortaklık kararı otomatik değil, yetkili onaylıdır.'] ].map(([Icon, title, text]) => {
            const Component = Icon as typeof Globe2;
            return <div key={String(title)} className="rounded-2xl border border-slate-800 bg-slate-900/60 p-5"><Component className="mb-4 h-6 w-6 text-cyan-300" /><h2 className="font-bold text-white">{String(title)}</h2><p className="mt-2 text-sm leading-6 text-slate-400">{String(text)}</p></div>;
          })}
        </aside>
        <div className="rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl md:p-8">
          <h2 className="text-2xl font-black text-white">İş ortaklığı başvurusu</h2>
          <p className="mb-7 mt-2 text-sm text-slate-400">Başvurunuz alındığında Partner Ağı değerlendirme kuyruğuna eklenir.</p>
          <PartnerApplicationForm />
        </div>
      </section>
    </main>
  );
}
