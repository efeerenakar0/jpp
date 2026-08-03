'use client';

import { AlertTriangle, CheckCircle2, Globe2, Loader2, RefreshCw, Save } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Account = { id: string; companyName: string };
type Health = {
  providers: Record<string, { configured: boolean; message?: string }>;
  mailboxes: Array<{ status: string; _count: number }>;
  outbox: { queued: number; failed: number };
  reviewedCountryPolicies: number;
};
type Policy = {
  id: string;
  companyAccountId: string;
  countryCode: string;
  status: string;
  legalBasisNote: string;
  dailyCompanyLimit: number;
  dailyDomainLimit: number;
  dailyMailboxLimit: number;
  companyAccount: { companyName: string };
};

const statuses = [
  ['ALLOWED', 'İzinli'],
  ['MANUAL_REVIEW', 'Manuel inceleme'],
  ['CONSENT_REQUIRED', 'Açık izin gerekli'],
  ['BLOCKED', 'Engelli'],
  ['BLOCKED_PENDING_COUNTRY_REVIEW', 'İnceleme bekliyor'],
] as const;

export default function PlatformPartnerOperations() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [health, setHealth] = useState<Health | null>(null);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ companyAccountId: '', countryCode: 'DE', status: 'MANUAL_REVIEW', legalBasisNote: '', dailyCompanyLimit: 25, dailyDomainLimit: 3, dailyMailboxLimit: 25 });

  const load = useCallback(async () => {
    setError('');
    const [accountsResponse, healthResponse, policiesResponse] = await Promise.all([
      fetch('/api/platform-admin/accounts', { cache: 'no-store' }),
      fetch('/api/platform-admin/partners/health', { cache: 'no-store' }),
      fetch('/api/platform-admin/partners/country-policies', { cache: 'no-store' }),
    ]);
    const [accountsData, healthData, policiesData] = await Promise.all([accountsResponse.json(), healthResponse.json(), policiesResponse.json()]);
    if (!accountsResponse.ok || !healthResponse.ok || !policiesResponse.ok) throw new Error('Partner altyapısı bilgileri alınamadı.');
    const nextAccounts = (accountsData.accounts || []).map((account: Account) => ({ id: account.id, companyName: account.companyName }));
    setAccounts(nextAccounts);
    setHealth(healthData);
    setPolicies(policiesData.policies || []);
    setForm((current) => ({ ...current, companyAccountId: current.companyAccountId || nextAccounts[0]?.id || '' }));
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => load().catch((reason) => setError(reason instanceof Error ? reason.message : 'Bağlantı hatası')).finally(() => setLoading(false)), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function savePolicy() {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/platform-admin/partners/country-policies', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, consentRequired: form.status === 'CONSENT_REQUIRED' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Ülke politikası kaydedilemedi.');
      setMessage('Ülke politikası ve gönderim limitleri kaydedildi.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Kayıt başarısız.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Globe2 className="h-5 w-5 text-emerald-400" />Global Partner Ağı</h2>
          <p className="mt-1 text-sm text-slate-400">Gmail, kaynak sağlayıcıları, e-posta kuyruğu ve ülke bazlı gönderim izinleri.</p>
        </div>
        <button className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm hover:bg-slate-800 disabled:opacity-50" disabled={loading} onClick={() => load().catch((reason) => setError(reason.message))} type="button"><RefreshCw className="h-4 w-4" />Yenile</button>
      </div>
      {error && <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</p>}
      {message && <p className="mt-4 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-200">{message}</p>}
      {loading ? <div className="flex h-24 items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-emerald-400" /></div> : (
        <>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {health && Object.entries(health.providers).map(([name, provider]) => (
              <div key={name} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3">
                <div className="flex items-center gap-2 text-sm font-medium">{provider.configured ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertTriangle className="h-4 w-4 text-amber-400" />}{name}</div>
                <p className="mt-2 text-xs text-slate-500">{provider.message || (provider.configured ? 'Yapılandırıldı' : 'Yapılandırılmadı')}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1.2fr]">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <h3 className="font-medium">Ülke politikasını incele</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <label className="text-xs text-slate-400">Şirket<select className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white" value={form.companyAccountId} onChange={(event) => setForm({ ...form, companyAccountId: event.target.value })}>{accounts.map((account) => <option key={account.id} value={account.id}>{account.companyName}</option>)}</select></label>
                <label className="text-xs text-slate-400">ISO-2 ülke kodu<input className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm uppercase text-white" maxLength={2} value={form.countryCode} onChange={(event) => setForm({ ...form, countryCode: event.target.value.toUpperCase() })} /></label>
                <label className="text-xs text-slate-400 sm:col-span-2">Durum<select className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })}>{statuses.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
                <label className="text-xs text-slate-400 sm:col-span-2">Hukuki değerlendirme notu<textarea className="mt-1 min-h-24 w-full rounded-lg border border-slate-700 bg-slate-950 p-3 text-sm text-white" placeholder="Ülkeye özel hukuki temel, kapsam ve inceleme tarihi…" value={form.legalBasisNote} onChange={(event) => setForm({ ...form, legalBasisNote: event.target.value })} /></label>
                {(['dailyCompanyLimit', 'dailyDomainLimit', 'dailyMailboxLimit'] as const).map((key) => <label key={key} className="text-xs text-slate-400">{key === 'dailyCompanyLimit' ? 'Şirket/gün' : key === 'dailyDomainLimit' ? 'Domain/gün' : 'Mailbox/gün'}<input className="mt-1 h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white" min={1} type="number" value={form[key]} onChange={(event) => setForm({ ...form, [key]: Number(event.target.value) })} /></label>)}
              </div>
              <button className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-slate-950 hover:bg-emerald-400 disabled:opacity-50" disabled={saving || !form.companyAccountId || form.legalBasisNote.trim().length < 5} onClick={savePolicy} type="button">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Politikayı kaydet</button>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-medium">İncelenen politikalar</h3><span className="text-xs text-slate-500">Kuyruk {health?.outbox.queued || 0} · Hata {health?.outbox.failed || 0}</span></div>
              <div className="mt-3 max-h-80 space-y-2 overflow-y-auto pr-1">
                {policies.map((policy) => <div key={policy.id} className="rounded-lg border border-slate-800 bg-slate-950/70 p-3"><div className="flex items-center justify-between gap-2"><p className="text-sm font-medium">{policy.companyAccount.companyName} · {policy.countryCode}</p><span className="rounded-full border border-slate-700 px-2 py-1 text-[11px] text-slate-300">{policy.status}</span></div><p className="mt-2 line-clamp-2 text-xs text-slate-500">{policy.legalBasisNote}</p><p className="mt-2 text-[11px] text-slate-600">Şirket {policy.dailyCompanyLimit} · Domain {policy.dailyDomainLimit} · Mailbox {policy.dailyMailboxLimit}</p></div>)}
                {policies.length === 0 && <p className="rounded-lg border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">Henüz incelenmiş ülke politikası yok. Gönderimler kapalı kalır.</p>}
              </div>
            </div>
          </div>
        </>
      )}
    </section>
  );
}
