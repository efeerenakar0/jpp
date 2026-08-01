'use client';

import { useEffect, useState } from 'react';
import { Clipboard, Code2, Download, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

type Company = { id: string; companyName: string; slug: string };
type GeneratedSite = {
  id: string;
  companyName: string;
  primaryColor: string;
  status: string;
  promptTemplate: string;
  createdAt: string;
  companyAccount: Company | null;
};
type Integration = {
  id: string;
  displayName: string;
  websiteUrl: string;
  framework: string;
  hostingProvider: string;
  status: string;
  promptTemplate: string;
  downloadUrl: string;
  submittedAt: string;
  companyAccount: Company;
};

export default function PlatformWebsiteProjects() {
  const [loading, setLoading] = useState(true);
  const [generatedSites, setGeneratedSites] = useState<GeneratedSite[]>([]);
  const [integrations, setIntegrations] = useState<Integration[]>([]);

  async function load() {
    setLoading(true);
    try {
      const response = await fetch('/api/platform-admin/website-integrations', {
        cache: 'no-store',
      });
      const data = (await response.json()) as {
        generatedSites?: GeneratedSite[];
        integrations?: Integration[];
        error?: string;
      };
      if (!response.ok) throw new Error(data.error || 'Web projeleri alınamadı.');
      setGeneratedSites(data.generatedSites || []);
      setIntegrations(data.integrations || []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Web projeleri alınamadı.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  async function copyPrompt(prompt: string) {
    await navigator.clipboard.writeText(prompt);
    toast.success('Codex promptu kopyalandı.');
  }

  return (
    <section className="mx-auto mt-6 max-w-7xl rounded-2xl border border-slate-800 bg-slate-950/60 p-5 text-slate-100 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-300">Web operasyonu</p>
          <h2 className="mt-2 text-2xl font-bold text-white">Site projeleri ve Codex promptları</h2>
          <p className="mt-2 text-sm text-slate-400">Yeni oluşturulan siteler ve mevcut site bağlantı talepleri burada otomatik görünür.</p>
        </div>
        <button type="button" onClick={() => void load()} aria-label="Web projelerini yenile" className="rounded-lg border border-slate-700 p-2.5 text-slate-300 hover:bg-slate-800">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {loading ? <div className="flex min-h-32 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-emerald-300" /></div> : (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Yeni site projeleri ({generatedSites.length})</h3>
            <div className="space-y-3">
              {generatedSites.length === 0 ? <p className="rounded-xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">Henüz yeni site projesi yok.</p> : generatedSites.map((site) => (
                <article key={site.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between gap-3"><div><h4 className="font-semibold text-white">{site.companyName}</h4><p className="mt-1 text-xs text-slate-400">{site.companyAccount?.companyName || 'Eski kayıt'} · {new Date(site.createdAt).toLocaleString('tr-TR')}</p></div><span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">{site.status}</span></div>
                  <button type="button" onClick={() => void copyPrompt(site.promptTemplate)} className="mt-4 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-slate-950 hover:bg-emerald-300"><Clipboard className="h-4 w-4" />Codex promptunu kopyala</button>
                </article>
              ))}
            </div>
          </div>
          <div>
            <h3 className="mb-3 text-sm font-semibold text-white">Mevcut site bağlantıları ({integrations.length})</h3>
            <div className="space-y-3">
              {integrations.length === 0 ? <p className="rounded-xl border border-dashed border-slate-800 p-5 text-sm text-slate-500">Henüz site bağlantı talebi yok.</p> : integrations.map((item) => (
                <article key={item.id} className="rounded-xl border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-start justify-between gap-3"><div className="min-w-0"><h4 className="truncate font-semibold text-white">{item.displayName}</h4><p className="mt-1 truncate text-xs text-slate-400">{item.companyAccount.companyName} · {item.framework} · {item.hostingProvider}</p></div><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{item.status}</span></div>
                  <div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => void copyPrompt(item.promptTemplate)} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-emerald-400 px-3 text-sm font-semibold text-slate-950"><Code2 className="h-4 w-4" />Prompt</button><a href={item.downloadUrl} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-700 px-3 text-sm font-medium text-slate-200"><Download className="h-4 w-4" />Kaynak kod</a></div>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
