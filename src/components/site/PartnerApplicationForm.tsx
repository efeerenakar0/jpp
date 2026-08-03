'use client';

import { useState } from 'react';
import { CheckCircle2, Loader2 } from 'lucide-react';

const inputClass = 'w-full rounded-xl border border-slate-700 bg-slate-950 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-400 focus:ring-2 focus:ring-cyan-400/15';

export default function PartnerApplicationForm() {
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = new FormData(event.currentTarget);
    const payload = {
      companyName: form.get('companyName'), contactName: form.get('contactName'), email: form.get('email'), phone: form.get('phone'),
      country: form.get('country'), countryCode: form.get('countryCode'), city: form.get('city'), websiteUrl: form.get('websiteUrl'),
      languages: String(form.get('languages') || '').split(',').map((value) => value.trim()).filter(Boolean),
      specialties: String(form.get('specialties') || '').split(',').map((value) => value.trim()).filter(Boolean),
      licenseNumber: form.get('licenseNumber') || undefined, partnerType: form.get('partnerType'), message: form.get('message') || undefined,
      privacyConsent: form.get('privacyConsent') === 'on', websiteFax: form.get('websiteFax') || undefined,
    };
    try {
      const response = await fetch('/api/partners/apply', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await response.json() as { success?: boolean; message?: string; error?: string };
      if (!response.ok || !data.success) throw new Error(data.error || 'Başvuru alınamadı.');
      setMessage({ ok: true, text: data.message || 'Başvurunuz alındı.' });
      event.currentTarget.reset();
    } catch (error) {
      setMessage({ ok: false, text: error instanceof Error ? error.message : 'Başvuru alınamadı.' });
    } finally { setPending(false); }
  }

  return (
    <form onSubmit={submit} className="space-y-5" noValidate>
      <input name="websiteFax" className="hidden" tabIndex={-1} autoComplete="off" aria-hidden="true" />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="space-y-2 text-sm font-semibold text-slate-300">Firma adı<input required name="companyName" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">Yetkili kişi<input required name="contactName" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">Kurumsal e-posta<input required type="email" name="email" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">Telefon<input required type="tel" name="phone" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">Ülke<input required name="country" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">İki harfli ülke kodu<input required name="countryCode" maxLength={2} placeholder="DE" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">Şehir<input required name="city" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">Web sitesi (isteğe bağlı)<input type="url" name="websiteUrl" placeholder="https://" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300 md:col-span-2">Diller (virgülle ayırın)<input required name="languages" placeholder="Almanca, İngilizce" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300 md:col-span-2">Uzmanlıklar (virgülle ayırın)<input required name="specialties" placeholder="Lüks konut, yatırım, yabancı alıcı" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">Lisans / kayıt no (isteğe bağlı)<input name="licenseNumber" className={inputClass} /></label>
        <label className="space-y-2 text-sm font-semibold text-slate-300">İş ortaklığı türü<select name="partnerType" className={inputClass} defaultValue="REFERRAL"><option value="REFERRAL">Müşteri yönlendirme</option><option value="SALES">Satış ortaklığı</option><option value="PROJECT">Proje ortaklığı</option><option value="OTHER">Diğer</option></select></label>
      </div>
      <label className="block space-y-2 text-sm font-semibold text-slate-300">Kısa mesaj (isteğe bağlı)<textarea name="message" rows={4} className={inputClass} /></label>
      <label className="flex items-start gap-3 text-sm text-slate-400"><input required type="checkbox" name="privacyConsent" className="mt-1 h-4 w-4 accent-cyan-400" /><span>Başvurumun değerlendirilmesi amacıyla verdiğim bilgilerin işlenmesini kabul ediyorum. Bu onay pazarlama iletisi izni değildir.</span></label>
      {message && <div role="status" className={`rounded-xl border px-4 py-3 text-sm ${message.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200' : 'border-rose-500/30 bg-rose-500/10 text-rose-200'}`}>{message.ok && <CheckCircle2 className="mr-2 inline h-4 w-4" />}{message.text}</div>}
      <button disabled={pending} className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-400 px-5 py-3.5 text-sm font-black text-slate-950 transition hover:bg-cyan-300 disabled:opacity-60">{pending && <Loader2 className="h-4 w-4 animate-spin" />}{pending ? 'Gönderiliyor…' : 'Başvuruyu gönder'}</button>
    </form>
  );
}
