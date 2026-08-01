'use client';

import Link from 'next/link';
import { LoaderCircle, X } from 'lucide-react';
import { useEffect, useState } from 'react';

type Job = {
  id: string;
  kind: 'STUDIO' | 'HUNT';
  title: string;
  status: string;
  progress: number;
  href: string;
};

export default function FabrikaJobIndicator() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let active = true;
    async function load() {
      const response = await fetch('/api/fabrika/jobs', { cache: 'no-store' });
      if (!response.ok) return;
      const data = (await response.json()) as { jobs?: Job[] };
      if (active) setJobs(data.jobs || []);
    }
    void load();
    const timer = window.setInterval(() => void load(), 15_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  if (jobs.length === 0) return null;

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((value) => !value)} className="flex h-9 items-center gap-2 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3 text-xs font-medium text-emerald-300" aria-expanded={open} aria-label={`${jobs.length} arka plan işlemi sürüyor`}>
        <LoaderCircle className="h-4 w-4 animate-spin" />
        <span className="hidden sm:inline">{jobs.length} işlem</span>
      </button>
      {open ? (
        <div className="absolute right-0 top-11 z-50 w-80 rounded-xl border border-slate-700 bg-slate-950 p-3 shadow-2xl">
          <div className="mb-3 flex items-center justify-between"><div><p className="text-sm font-semibold text-white">Arka plan işleri</p><p className="text-xs text-slate-500">Sayfadan ayrı çalışmaya devam eder</p></div><button type="button" onClick={() => setOpen(false)} aria-label="İş merkezini kapat" className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800"><X className="h-4 w-4" /></button></div>
          <div className="space-y-2">{jobs.map((job) => <Link key={job.id} href={job.href} onClick={() => setOpen(false)} className="block rounded-lg border border-slate-800 bg-slate-900 p-3 hover:border-slate-700"><div className="flex justify-between gap-3 text-xs"><span className="truncate font-medium text-slate-200">{job.title}</span><span className="text-emerald-300">%{job.progress}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-emerald-400 transition-all" style={{ width: `${Math.max(4, job.progress)}%` }} /></div><p className="mt-2 text-[10px] text-slate-500">{job.kind === 'STUDIO' ? 'Stüdyo' : 'Avcı'} · {job.status}</p></Link>)}</div>
        </div>
      ) : null}
    </div>
  );
}
