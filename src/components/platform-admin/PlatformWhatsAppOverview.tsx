'use client';

import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MessageCircle,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';

type Account = {
  companyAccountId: string;
  companyName: string;
  provider: string;
  connectionStatus: string;
  connectedPhone: string | null;
  connectedProfileName: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  queued: number;
};

type Failed = {
  id: string;
  companyAccountId: string;
  toPhone: string;
  lastError: string | null;
  attemptCount: number;
  updatedAt: string;
};

export default function PlatformWhatsAppOverview() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [failed, setFailed] = useState<Failed[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState<string | null>(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const response = await fetch('/api/platform-admin/whatsapp', {
      cache: 'no-store',
    });
    const data = (await response.json()) as {
      accounts?: Account[];
      failed?: Failed[];
      error?: string;
    };
    if (!response.ok) throw new Error(data.error || 'WhatsApp durumu alınamadı.');
    setAccounts(data.accounts || []);
    setFailed(data.failed || []);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      load()
        .catch((reason) =>
          setError(reason instanceof Error ? reason.message : 'Bağlantı hatası')
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function action(payload: Record<string, string>, key: string) {
    setWorking(key);
    setError('');
    try {
      const response = await fetch('/api/platform-admin/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'İşlem başarısız.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'İşlem başarısız.');
    } finally {
      setWorking(null);
    }
  }

  return (
    <section className="mb-8 rounded-2xl border border-slate-800 bg-slate-950 p-5 text-slate-100">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold">
            <MessageCircle className="h-5 w-5 text-emerald-400" />
            WhatsApp altyapı merkezi
          </h2>
          <p className="mt-1 text-sm text-slate-400">
            Şirket bağlantıları, kuyruklar ve başarısız gönderimler. Hiçbir gizli anahtar gösterilmez.
          </p>
        </div>
        <button
          className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-700 px-3 text-sm text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          disabled={loading}
          onClick={() => load().catch((reason) => setError(reason.message))}
          type="button"
        >
          <RefreshCw className="h-4 w-4" /> Yenile
        </button>
      </div>
      {error && (
        <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-200">
          {error}
        </p>
      )}
      {loading ? (
        <div className="mt-5 flex h-24 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-emerald-400" />
        </div>
      ) : (
        <div className="mt-5 grid gap-3 lg:grid-cols-2">
          {accounts.map((account) => {
            const connected = account.connectionStatus === 'CONNECTED';
            return (
              <article key={account.companyAccountId} className="rounded-xl border border-slate-800 bg-slate-900/60 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-white">{account.companyName}</h3>
                    <p className="mt-1 text-xs text-slate-500">
                      {account.provider} · {account.connectedProfileName || account.connectedPhone || 'Telefon yok'}
                    </p>
                  </div>
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs ${connected ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                    {connected ? <CheckCircle2 className="h-3 w-3" /> : <AlertTriangle className="h-3 w-3" />}
                    {account.connectionStatus}
                  </span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
                  <span>Kuyruk: {account.queued}</span>
                  <button
                    className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 disabled:opacity-50"
                    disabled={working === account.companyAccountId}
                    onClick={() => action({ action: 'refresh', companyAccountId: account.companyAccountId }, account.companyAccountId)}
                    type="button"
                  >
                    {working === account.companyAccountId ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                    Sağlık kontrolü
                  </button>
                </div>
                {account.lastError && (
                  <p className="mt-3 line-clamp-2 rounded-lg bg-rose-500/10 p-2 text-xs text-rose-200">
                    {account.lastError}
                  </p>
                )}
              </article>
            );
          })}
          {accounts.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-slate-700 p-6 text-center text-sm text-slate-500">
              Henüz WhatsApp bağlantısı hazırlayan şirket yok.
            </p>
          )}
        </div>
      )}
      {failed.length > 0 && (
        <div className="mt-5 border-t border-slate-800 pt-4">
          <h3 className="text-sm font-semibold text-white">Başarısız gönderimler</h3>
          <div className="mt-3 space-y-2">
            {failed.slice(0, 8).map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-900/40 p-3 text-xs">
                <div className="min-w-0">
                  <p className="text-slate-300">••••{item.toPhone.slice(-4)} · {item.attemptCount} deneme</p>
                  <p className="mt-1 truncate text-slate-500">{item.lastError || 'Bilinmeyen hata'}</p>
                </div>
                <button
                  className="inline-flex shrink-0 items-center gap-1 text-amber-300 hover:text-amber-200 disabled:opacity-50"
                  disabled={working === item.id}
                  onClick={() => action({ action: 'retry', outboxId: item.id }, item.id)}
                  type="button"
                >
                  {working === item.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  Tekrar dene
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
