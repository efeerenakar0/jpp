'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle, Building2, ChevronRight, CircleOff, ExternalLink,
  FileUp, Handshake, Loader2, Mail, RefreshCw, Search, Send, Settings2, ShieldCheck, X,
} from 'lucide-react';
import {
  filterPartnerDirectory,
  filterPartnersForQueue,
  getPartnerMessageStatusLabel,
  getPartnerQueueMetrics,
  getPartnerStageLabel,
} from '@/lib/partner-network-view';

type Partner = {
  id: string; displayName: string; legalName: string; countryCode: string; countryName: string; city: string | null;
  websiteUrl: string | null; logoUrl: string | null; languages: string[]; specialties: string[];
  fitScore: number; confidenceScore: number; stage: string; lastVerifiedAt: string | null;
  contacts: Array<{ id?: string; name?: string | null; emailMasked: string | null; emailDomain?: string | null; verificationStatus: string; active: boolean }>;
  sources: Array<{ id: string; type: string; sourceUrl: string | null; title: string | null; observedAt: string; trusted: boolean }>;
  _count?: { messages: number; activities: number };
};

type PartnerDetail = Partner & {
  drafts: Array<{ id: string; status: string; subject: string; body: string; language: string; turkishTranslation: string; warnings: string[]; updatedAt: string }>;
  messages: Array<{ id: string; status: string; recipientEmailMasked: string; subjectSnapshot: string; createdAt: string; sentAt: string | null; lastErrorCode: string | null }>;
  activities: Array<{ id: string; type: string; summary: string; createdAt: string }>;
  scoreSnapshots: Array<{ id: string; total: number; confidence: number; explanations: string[]; calculatedAt: string }>;
};

const tabs = [
  ['overview', 'Genel Bakış'], ['candidates', 'Aday Kurumlar'], ['approval', 'Onay Kuyruğu'],
  ['pipeline', 'Partner Süreci'], ['active', 'Aktif Partnerler'], ['settings', 'Ayarlar'],
] as const;
const stages = ['DISCOVERED', 'QUALIFIED', 'CONTACTED', 'ENGAGED', 'MEETING', 'REVIEW', 'AGREEMENT', 'ACTIVE', 'DISQUALIFIED', 'NOT_INTERESTED', 'DO_NOT_CONTACT', 'ARCHIVED'];
const mailboxStatusLabels: Record<string, string> = { CONNECTED: 'Bağlı', ERROR: 'Bağlantı hatası', REVOKED: 'Bağlantı kaldırıldı' };
const draftStatusLabels: Record<string, string> = { DRAFT: 'Taslak', READY_FOR_APPROVAL: 'Onay bekliyor', APPROVED: 'Onaylandı', INVALIDATED: 'Yeniden onay gerekli', QUEUED: 'Gönderim sırasında', SENT: 'Gönderildi', CANCELLED: 'İptal edildi' };
const sourceTypeLabels: Record<string, string> = { OFFICIAL_REGISTRY: 'Resmî kayıt', PROFESSIONAL_ASSOCIATION: 'Meslek birliği', AUTHORIZED_DIRECTORY_API: 'Yetkili dizin', PARTNER_FEED: 'Partner veri akışı', MANUAL_CSV: 'CSV kaynağı', FIRST_PARTY_APPLICATION: 'Doğrudan başvuru', OFFICIAL_COMPANY_WEBSITE: 'Kurumsal web sitesi' };

function relativeDate(value: string | null) {
  if (!value) return 'Henüz doğrulanmadı';
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'medium' }).format(new Date(value));
}

async function jsonRequest(url: string, init?: RequestInit) {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok || !data.success) throw new Error(data.error || 'İşlem tamamlanamadı.');
  return data;
}

export default function PartnerNetworkClient({
  initialPartners,
  owner,
  initialPartnerId = null,
  initialError = null,
}: {
  initialPartners: Partner[];
  owner: boolean;
  initialPartnerId?: string | null;
  initialError?: string | null;
}) {
  const [partners, setPartners] = useState(initialPartners);
  const [tab, setTab] = useState<(typeof tabs)[number][0]>('overview');
  const [search, setSearch] = useState('');
  const [country, setCountry] = useState('');
  const [city, setCity] = useState('');
  const [language, setLanguage] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [selected, setSelected] = useState<PartnerDetail | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(
    initialError ? { ok: false, text: initialError } : null,
  );
  const [mailbox, setMailbox] = useState<{ configured: boolean; mailbox: { email: string; status: string; lastTestedAt: string | null } | null } | null>(null);
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [discoveryCountry, setDiscoveryCountry] = useState('DE');

  const filtered = useMemo(() => filterPartnerDirectory(partners, {
    search,
    countryCode: country,
    city,
    language,
    specialty,
  }), [partners, search, country, city, language, specialty]);
  const countries = useMemo(() => [...new Map(partners.map((partner) => [partner.countryCode, partner.countryName])).entries()], [partners]);
  const cities = useMemo(() => [...new Set(partners.map((partner) => partner.city).filter((value): value is string => Boolean(value)))].sort((left, right) => left.localeCompare(right, 'tr-TR')), [partners]);
  const languages = useMemo(() => [...new Set(partners.flatMap((partner) => partner.languages))].sort((left, right) => left.localeCompare(right, 'tr-TR')), [partners]);
  const specialties = useMemo(() => [...new Set(partners.flatMap((partner) => partner.specialties))].sort((left, right) => left.localeCompare(right, 'tr-TR')), [partners]);
  const metrics = useMemo(() => getPartnerQueueMetrics(partners), [partners]);

  async function refreshPartners() {
    setBusy('refresh');
    try { const data = await jsonRequest('/api/fabrika/partners'); setPartners(data.partners); }
    catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Kayıtlar alınamadı.' }); }
    finally { setBusy(null); }
  }

  const openPartner = useCallback(async (id: string) => {
    setBusy(`partner:${id}`);
    try { const data = await jsonRequest(`/api/fabrika/partners/${id}`); setSelected(data.partner); }
    catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Partner açılamadı.' }); }
    finally { setBusy(null); }
  }, []);

  useEffect(() => {
    if (!initialPartnerId) return;

    const timer = window.setTimeout(() => {
      void openPartner(initialPartnerId);
    }, 0);

    return () => window.clearTimeout(timer);
  }, [initialPartnerId, openPartner]);

  async function updateStage(stage: string) {
    if (!selected) return;
    setBusy('stage');
    try {
      await jsonRequest(`/api/fabrika/partners/${selected.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ stage }) });
      await openPartner(selected.id); await refreshPartners();
    } catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Aşama güncellenemedi.' }); }
    finally { setBusy(null); }
  }

  async function createDraft() {
    if (!selected) return;
    setBusy('draft');
    try {
      await jsonRequest(`/api/fabrika/partners/${selected.id}/drafts`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      await openPartner(selected.id); setNotice({ ok: true, text: 'Kaynaklı e-posta taslağı oluşturuldu.' });
    } catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Taslak üretilemedi.' }); }
    finally { setBusy(null); }
  }

  async function verifyContact(contactId: string, decision: 'VERIFY' | 'REJECT') {
    if (!selected) return;
    const note = window.prompt(decision === 'VERIFY' ? 'Doğrulama kaynağını veya kontrol notunu yazın:' : 'Reddetme nedenini yazın:');
    if (!note || note.trim().length < 5) return;
    setBusy(`contact:${contactId}`);
    try {
      await jsonRequest(`/api/fabrika/partners/${selected.id}/contacts/${contactId}/verify`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ decision, note }),
      });
      await openPartner(selected.id);
      setNotice({ ok: true, text: decision === 'VERIFY' ? 'Kurumsal iletişim doğrulandı.' : 'Kurumsal iletişim reddedildi ve bekleyen gönderimler durduruldu.' });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'İletişim durumu güncellenemedi.' });
    } finally { setBusy(null); }
  }

  async function saveDraft(draft: PartnerDetail['drafts'][number], patch: Partial<typeof draft>) {
    setBusy(`draft:${draft.id}`);
    try {
      await jsonRequest(`/api/fabrika/partners/drafts/${draft.id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ subject: patch.subject ?? draft.subject, body: patch.body ?? draft.body, turkishTranslation: patch.turkishTranslation ?? draft.turkishTranslation }) });
      if (selected) await openPartner(selected.id);
      setNotice({ ok: true, text: 'Taslak kaydedildi; önceki onay varsa güvenlik için geçersiz kılındı.' });
    } catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Taslak kaydedilemedi.' }); }
    finally { setBusy(null); }
  }

  async function approve(draftId: string) {
    setBusy(`approve:${draftId}`);
    try { await jsonRequest(`/api/fabrika/partners/drafts/${draftId}/approve-and-send`, { method: 'POST' }); if (selected) await openPartner(selected.id); setNotice({ ok: true, text: 'İnsan onayı kaydedildi ve e-posta güvenli kuyruğa alındı.' }); }
    catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Gönderim onaylanamadı.' }); }
    finally { setBusy(null); }
  }

  async function suppressContact(contactId?: string) {
    if (!selected || !owner) return;
    const reason = window.prompt(
      'Bu kurumla iletişimin neden durdurulacağını yazın. Bekleyen mesajlar iptal edilir ve yeni gönderim engellenir:',
    );
    if (!reason || reason.trim().length < 3) return;
    setBusy(`suppress:${contactId || 'partner'}`);
    try {
      await jsonRequest(`/api/fabrika/partners/${selected.id}/suppress`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, reason }),
      });
      await openPartner(selected.id);
      await refreshPartners();
      setNotice({
        ok: true,
        text: 'İletişim durduruldu. Bekleyen gönderimler iptal edildi ve tekrar mesaj engellendi.',
      });
    } catch (error) {
      setNotice({ ok: false, text: error instanceof Error ? error.message : 'İletişim durdurulamadı.' });
    } finally {
      setBusy(null);
    }
  }

  async function importCsv() {
    if (!csvFile) return;
    setBusy('import');
    try {
      const csv = await csvFile.text();
      await jsonRequest('/api/fabrika/partners/discovery-runs', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ providerKey: 'manual_csv', countryCode: discoveryCountry, csv }) });
      await refreshPartners(); setNotice({ ok: true, text: 'CSV kayıtları kaynaklarıyla birlikte içe aktarıldı.' }); setCsvFile(null);
    } catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'CSV içe aktarılamadı.' }); }
    finally { setBusy(null); }
  }

  async function loadMailbox() {
    if (!owner) return;
    try { setMailbox(await jsonRequest('/api/fabrika/partners/mailbox')); }
    catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Gönderici durumu alınamadı.' }); }
  }
  function selectTab(value: (typeof tabs)[number][0]) {
    setTab(value);
    if (value === 'settings' && owner && !mailbox) void loadMailbox();
  }

  async function connectMailbox() {
    setBusy('mailbox');
    try { const data = await jsonRequest('/api/fabrika/partners/google/connect', { method: 'POST' }); window.location.assign(data.authorizationUrl); }
    catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Bağlantı başlatılamadı.' }); setBusy(null); }
  }

  async function testMailbox() {
    setBusy('mailbox');
    try { const data = await jsonRequest('/api/fabrika/partners/google/test', { method: 'POST' }); setNotice({ ok: true, text: data.message }); await loadMailbox(); }
    catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Test başarısız.' }); }
    finally { setBusy(null); }
  }

  async function disconnectMailbox() {
    if (!confirm('Gönderici bağlantısı kaldırılsın mı? Bekleyen e-postalar iptal edilir.')) return;
    setBusy('mailbox');
    try { await jsonRequest('/api/fabrika/partners/google/disconnect', { method: 'DELETE' }); await loadMailbox(); }
    catch (error) { setNotice({ ok: false, text: error instanceof Error ? error.message : 'Bağlantı kaldırılamadı.' }); }
    finally { setBusy(null); }
  }

  const listForTab = useMemo(() => {
    switch (tab) {
      case 'candidates': return filterPartnersForQueue(filtered, 'candidates');
      case 'approval': return filterPartnersForQueue(filtered, 'approval');
      case 'pipeline': return filterPartnersForQueue(filtered, 'pipeline');
      case 'active': return filterPartnersForQueue(filtered, 'active');
      default: return [];
    }
  }, [filtered, tab]);

  return (
    <div className="space-y-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">Global iş geliştirme</p><h1 className="mt-2 text-3xl font-black text-white">Partner Ağı</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Doğrulanabilir kurumsal kaynaklardan partner adaylarını değerlendirin, insan onaylı ilk teması yönetin.</p></div>
        <button onClick={refreshPartners} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm font-semibold text-slate-200 hover:bg-slate-800"><RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} /> Yenile</button>
      </header>
      {notice && <div role="status" className={`flex items-center justify-between rounded-xl border px-4 py-3 text-sm ${notice.ok ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100' : 'border-rose-500/30 bg-rose-500/10 text-rose-100'}`}><span>{notice.text}</span><button onClick={() => setNotice(null)} aria-label="Bildirimi kapat"><X className="h-4 w-4" /></button></div>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[['Yeni aday', metrics.candidates, Building2], ['Doğrulama bekleyen', metrics.approval, ShieldCheck], ['İletişim sürecinde', metrics.pipeline, Mail], ['Aktif partner', metrics.active, Handshake]].map(([label, value, Icon]) => { const Component = Icon as typeof Building2; return <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="flex items-center justify-between"><span className="text-sm text-slate-400">{String(label)}</span><Component className="h-5 w-5 text-emerald-400" /></div><strong className="mt-3 block text-2xl text-white">{String(value)}</strong></div>; })}
      </div>
      <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-900 p-1"><div className="flex min-w-max gap-1" role="tablist" aria-label="Partner ağı bölümleri">{tabs.map(([value, label]) => <button key={value} role="tab" aria-selected={tab === value} onClick={() => selectTab(value)} className={`rounded-lg px-4 py-2.5 text-sm font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${tab === value ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>{label}</button>)}</div></div>

      {tab === 'overview' && <div className="grid gap-5 lg:grid-cols-2"><section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">Güvenli partner bulma akışı</h2><div className="mt-4 space-y-3 text-sm">{[['Kaynak', 'Yalnız doğrulanabilir kurum kayıtları'], ['Taslak', 'AI metni hazırlar; kendiliğinden göndermez'], ['Onay', 'İlk temas her zaman patron onayı ister'], ['Yanıt', 'Gelen kutusu senkronu yok; yanıt durumu manuel kaydedilir'], ['Sınır', 'İlk mesajdan sonra en fazla iki takip'], ['Vazgeçme', 'İletişimi durdur seçeneği yeni gönderimleri engeller']].map(([a,b]) => <div key={a} className="flex items-center justify-between gap-4 border-b border-slate-800 pb-3"><span className="text-slate-400">{a}</span><span className="text-right text-slate-200">{b}</span></div>)}</div></section><section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h2 className="font-bold text-white">Süreç dağılımı</h2><div className="mt-4 space-y-3">{stages.slice(0,8).map((stage) => { const count=partners.filter((p)=>p.stage===stage).length; return <div key={stage} className="flex items-center gap-3"><span className="w-32 text-sm text-slate-400">{getPartnerStageLabel(stage)}</span><div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800"><div className="h-full bg-emerald-500" style={{width: partners.length ? `${Math.max(count ? 6 : 0, count/partners.length*100)}%`:'0%'}} /></div><strong className="w-6 text-right text-sm text-white">{count}</strong></div>})}</div></section></div>}

      {tab === 'settings' && <div className="grid gap-5 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center gap-3"><Settings2 className="h-5 w-5 text-emerald-400" /><h2 className="font-bold text-white">Merkezi gönderici</h2></div>{!owner ? <p className="mt-4 text-sm text-amber-200">Bu ayar yalnız şirket patronuna açıktır.</p> : !mailbox ? <Loader2 className="mt-5 h-5 w-5 animate-spin text-slate-400" /> : <div className="mt-5 space-y-4"><div className="rounded-lg bg-slate-950 p-4"><p className="text-xs text-slate-500">Durum</p><p className="mt-1 font-semibold text-white">{mailbox.mailbox ? `${mailbox.mailbox.email} · ${mailboxStatusLabels[mailbox.mailbox.status] || 'Durum bilinmiyor'}` : 'Bağlı hesap yok'}</p></div><div className="flex flex-wrap gap-2">{!mailbox.mailbox || mailbox.mailbox.status === 'REVOKED' ? <button disabled={!mailbox.configured || busy==='mailbox'} onClick={connectMailbox} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-50">Göndericiyi bağla</button> : <><button onClick={testMailbox} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-bold text-slate-950">Bağlantıyı test et</button><button onClick={disconnectMailbox} className="rounded-lg border border-rose-500/30 px-4 py-2 text-sm font-semibold text-rose-200">Bağlantıyı kaldır</button></>}</div>{!mailbox.configured && <p className="text-sm text-amber-200">Sistem yöneticisi merkezi Google bağlantısını henüz yapılandırmadı.</p>}</div>}</section>
        <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><div className="flex items-center gap-3"><FileUp className="h-5 w-5 text-emerald-400" /><h2 className="font-bold text-white">Kaynaklı CSV içe aktarımı</h2></div><p className="mt-2 text-sm text-slate-400">En fazla 25 kaliteli kurum gösterilir. Her satırda kaynak URL’si zorunludur; uydurma kayıt oluşturulmaz.</p><select value={discoveryCountry} onChange={(e)=>setDiscoveryCountry(e.target.value)} className="mt-4 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"><option value="DE">Almanya</option><option value="GB">Birleşik Krallık</option><option value="AE">BAE</option><option value="TR">Türkiye</option></select><input type="file" accept=".csv,text/csv" onChange={(e)=>setCsvFile(e.target.files?.[0]||null)} className="mt-3 block w-full text-sm text-slate-400 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-800 file:px-4 file:py-2 file:text-slate-200"/><button disabled={!csvFile||busy==='import'} onClick={importCsv} className="mt-3 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{busy==='import'?'İçe aktarılıyor…':'CSV’yi içe aktar'}</button></section>
      </div>}

      {['candidates','approval','pipeline','active'].includes(tab) && <section className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"><label className="relative sm:col-span-2 xl:col-span-1"><span className="sr-only">Partner ara</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500"/><input value={search} onChange={(e)=>setSearch(e.target.value)} placeholder="Kurum veya bölge ara" className="w-full rounded-lg border border-slate-700 bg-slate-950 py-2.5 pl-10 pr-3 text-sm text-white outline-none focus:border-emerald-500"/></label><select aria-label="Ülke filtresi" value={country} onChange={(e)=>setCountry(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">Tüm ülkeler</option>{countries.map(([code,name])=><option key={code} value={code}>{name}</option>)}</select><select aria-label="Şehir filtresi" value={city} onChange={(e)=>setCity(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">Tüm şehirler</option>{cities.map((item)=><option key={item} value={item}>{item}</option>)}</select><select aria-label="Dil filtresi" value={language} onChange={(e)=>setLanguage(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">Tüm diller</option>{languages.map((item)=><option key={item} value={item}>{item}</option>)}</select><select aria-label="Uzmanlık filtresi" value={specialty} onChange={(e)=>setSpecialty(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white"><option value="">Tüm uzmanlıklar</option>{specialties.map((item)=><option key={item} value={item}>{item}</option>)}</select></div>{listForTab.length===0?<div className="rounded-xl border border-dashed border-slate-700 py-16 text-center"><CircleOff className="mx-auto h-8 w-8 text-slate-600"/><p className="mt-3 font-semibold text-slate-300">Bu görünümde kayıt yok</p><p className="mt-1 text-sm text-slate-500">Kaynak ekleyin veya filtreleri değiştirin.</p></div>:<div className="grid gap-3">{listForTab.map((partner)=><button key={partner.id} onClick={()=>openPartner(partner.id)} className="grid gap-4 rounded-xl border border-slate-800 bg-slate-900 p-4 text-left transition hover:border-emerald-500/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 sm:grid-cols-[1fr_auto] sm:items-center"><div className="flex items-start gap-4"><div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400"><Building2 className="h-5 w-5"/></div><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-bold text-white">{partner.displayName}</h3><span className="rounded-full bg-slate-800 px-2 py-1 text-[11px] text-slate-300">{getPartnerStageLabel(partner.stage)}</span></div><p className="mt-1 text-sm text-slate-400">{partner.city ? `${partner.city}, `:''}{partner.countryName} · {partner.languages.slice(0,2).join(' · ')||'Dil belirtilmedi'} · {partner.specialties.slice(0,2).join(' · ')||'Uzmanlık belirtilmedi'}</p><p className="mt-2 text-xs text-slate-500">Kaynak: {partner.sources[0]?.title||'Başvuru'} · {relativeDate(partner.lastVerifiedAt)}</p></div></div><div className="flex items-center gap-5"><div className="text-right"><p className="text-xs text-slate-500">Uygunluk / Güven</p><p className="font-bold text-white">{Math.round(partner.fitScore)} / %{Math.round(partner.confidenceScore)}</p></div>{busy===`partner:${partner.id}`?<Loader2 className="h-5 w-5 animate-spin text-emerald-400"/>:<ChevronRight className="h-5 w-5 text-slate-500"/>}</div></button>)}</div>}</section>}

      {selected && <div className="fixed inset-0 z-[80] flex justify-end bg-slate-950/70" onMouseDown={(e)=>{if(e.currentTarget===e.target)setSelected(null)}}><aside className="h-full w-full max-w-3xl overflow-y-auto border-l border-slate-800 bg-[#0b1322] p-5 shadow-2xl sm:p-7"><div className="flex items-start justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-wider text-emerald-400">{selected.countryName}</p><h2 className="mt-1 text-2xl font-black text-white">{selected.displayName}</h2><p className="mt-1 text-sm text-slate-400">{selected.city||'Şehir belirtilmedi'} · Uygunluk {Math.round(selected.fitScore)} · Güven %{Math.round(selected.confidenceScore)}</p></div><button onClick={()=>setSelected(null)} className="rounded-lg border border-slate-700 p-2 text-slate-400 hover:text-white"><X className="h-5 w-5"/></button></div><div className="mt-6 grid gap-3 sm:grid-cols-2">{owner ? <select value={selected.stage} onChange={(e)=>updateStage(e.target.value)} disabled={busy==='stage'} aria-label="Partner aşaması" className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-white">{stages.map((stage)=><option key={stage} value={stage}>{getPartnerStageLabel(stage)}</option>)}</select> : <div className="rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5 text-sm text-slate-300"><span className="text-slate-500">Aşama: </span>{getPartnerStageLabel(selected.stage)}</div>}<button disabled={busy==='draft'} onClick={createDraft} className="flex items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-bold text-slate-950 disabled:opacity-50">{busy==='draft'?<Loader2 className="h-4 w-4 animate-spin"/>:<Mail className="h-4 w-4"/>} Kaynaklı e-posta hazırla</button></div>{selected.websiteUrl&&<a href={selected.websiteUrl} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-cyan-300">Kurumsal siteyi aç <ExternalLink className="h-4 w-4"/></a>}
        <section className="mt-7"><div className="flex flex-wrap items-center justify-between gap-3"><h3 className="font-bold text-white">Kurumsal iletişim</h3>{owner && selected.stage !== 'DO_NOT_CONTACT' && <button disabled={busy?.startsWith('suppress:')} onClick={()=>suppressContact()} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50">İletişimi tamamen durdur</button>}</div><div className="mt-3 space-y-2">{selected.contacts.map((contact)=><div key={contact.id || contact.emailMasked} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900 p-3"><div><p className="text-sm font-semibold text-slate-200">{contact.emailMasked || 'Adres maskelendi'}</p><p className={`mt-1 text-xs ${contact.verificationStatus.includes('VERIFIED') ? 'text-emerald-300' : contact.verificationStatus === 'REJECTED' ? 'text-rose-300' : 'text-amber-300'}`}>{contact.verificationStatus.includes('VERIFIED') ? 'Gönderime uygun kurumsal adres' : contact.verificationStatus === 'REJECTED' ? 'Reddedildi' : 'Patron doğrulaması bekliyor'}</p></div>{owner && contact.id && <div className="flex flex-wrap gap-2">{!contact.verificationStatus.includes('VERIFIED') && <><button disabled={busy===`contact:${contact.id}`} onClick={()=>verifyContact(contact.id!, 'VERIFY')} className="rounded-lg bg-emerald-500 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-50">Doğrula</button><button disabled={busy===`contact:${contact.id}`} onClick={()=>verifyContact(contact.id!, 'REJECT')} className="rounded-lg border border-rose-500/30 px-3 py-2 text-xs font-semibold text-rose-200 disabled:opacity-50">Reddet</button></>}<button disabled={busy===`suppress:${contact.id}`} onClick={()=>suppressContact(contact.id)} className="rounded-lg border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 disabled:opacity-50">Bu adresi durdur</button></div>}</div>)}{selected.contacts.length===0&&<p className="text-sm text-slate-500">Kurumsal iletişim bulunamadı.</p>}</div></section>
        <section className="mt-7"><h3 className="font-bold text-white">Doğrulanmış kaynaklar</h3><div className="mt-3 space-y-2">{selected.sources.map((source)=><div key={source.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3"><div className="flex items-center justify-between gap-3"><span className="text-sm font-semibold text-slate-200">{source.title||sourceTypeLabels[source.type]||'Kaynak'}</span><span className={`text-xs ${source.trusted?'text-emerald-300':'text-amber-300'}`}>{source.trusted?'Doğrulanmış':'Manuel inceleme'}</span></div>{source.sourceUrl&&<a className="mt-2 block truncate text-xs text-cyan-300" href={source.sourceUrl} target="_blank" rel="noreferrer">{source.sourceUrl}</a>}</div>)}</div></section>
        <section className="mt-7"><h3 className="font-bold text-white">E-posta taslakları</h3>{selected.drafts.length===0?<p className="mt-3 text-sm text-slate-500">Henüz taslak yok.</p>:<div className="mt-3 space-y-4">{selected.drafts.map((draft)=><DraftEditor key={draft.id} draft={draft} busy={busy===`draft:${draft.id}`||busy===`approve:${draft.id}`} canApprove={owner} onSave={saveDraft} onApprove={()=>approve(draft.id)}/>)}</div>}</section>
        <section className="mt-7"><h3 className="font-bold text-white">Gönderim geçmişi</h3><p className="mt-1 text-xs leading-5 text-slate-500">Gönderim ve teslim bilgisi sağlayıcı kaydıdır. Gelen kutusu senkronu olmadığı için partner yanıtları burada otomatik doğrulanmaz.</p>{selected.messages.length===0?<p className="mt-3 text-sm text-slate-500">Henüz onaylanmış gönderim yok.</p>:<div className="mt-3 space-y-2">{selected.messages.map((message)=><div key={message.id} className="rounded-lg border border-slate-800 bg-slate-900 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-semibold text-slate-200">{message.subjectSnapshot}</p><span className={`rounded-full px-2 py-1 text-xs ${['FAILED','CANCELLED'].includes(message.status)?'bg-rose-500/10 text-rose-200':['SENT','DELIVERED'].includes(message.status)?'bg-emerald-500/10 text-emerald-200':'bg-amber-500/10 text-amber-200'}`}>{getPartnerMessageStatusLabel(message.status)}</span></div><p className="mt-1 text-xs text-slate-500">{message.recipientEmailMasked} · {relativeDate(message.sentAt || message.createdAt)}</p>{message.lastErrorCode&&<p className="mt-2 text-xs text-rose-300">İşlem kodu: {message.lastErrorCode}</p>}</div>)}</div>}</section>
        <section className="mt-7"><h3 className="font-bold text-white">İşlem geçmişi</h3><div className="mt-3 space-y-2">{selected.activities.map((activity)=><div key={activity.id} className="border-l-2 border-slate-700 pl-3"><p className="text-sm text-slate-200">{activity.summary}</p><p className="text-xs text-slate-500">{relativeDate(activity.createdAt)}</p></div>)}</div></section>
      </aside></div>}
    </div>
  );
}

function DraftEditor({ draft, busy, canApprove, onSave, onApprove }: { draft: PartnerDetail['drafts'][number]; busy: boolean; canApprove: boolean; onSave: (draft: PartnerDetail['drafts'][number], patch: Partial<PartnerDetail['drafts'][number]>)=>void; onApprove: ()=>void }) {
  const [subject,setSubject]=useState(draft.subject); const [body,setBody]=useState(draft.body); const [translation,setTranslation]=useState(draft.turkishTranslation);
  return <div className="rounded-xl border border-slate-800 bg-slate-900 p-4"><div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{draftStatusLabels[draft.status] || 'Durum bilinmiyor'}</span>{draft.warnings.length>0&&<span className="flex items-center gap-1 text-xs text-amber-300"><AlertTriangle className="h-3.5 w-3.5"/>{draft.warnings.length} uyarı</span>}</div><label className="text-xs font-semibold text-slate-400">Konu<input value={subject} onChange={(e)=>setSubject(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"/></label><label className="mt-3 block text-xs font-semibold text-slate-400">Hedef dilde e-posta<textarea value={body} onChange={(e)=>setBody(e.target.value)} rows={8} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-white"/></label><label className="mt-3 block text-xs font-semibold text-slate-400">Türkçe çeviri<textarea value={translation} onChange={(e)=>setTranslation(e.target.value)} rows={5} className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-sm leading-6 text-white"/></label><div className="mt-3 flex flex-wrap gap-2"><button disabled={busy} onClick={()=>onSave(draft,{subject,body,turkishTranslation:translation})} className="rounded-lg border border-slate-700 px-3 py-2 text-sm font-semibold text-slate-200">Değişiklikleri kaydet</button>{canApprove&&<button disabled={busy||draft.status==='SENT'} onClick={onApprove} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-bold text-slate-950 disabled:opacity-50"><Send className="h-4 w-4"/> Onayla ve kuyruğa al</button>}</div></div>;
}
