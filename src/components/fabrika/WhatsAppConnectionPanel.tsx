'use client';

import Image from 'next/image';
import {
  AlertTriangle,
  CheckCircle2,
  Link2,
  Loader2,
  MessageCircle,
  Phone,
  Power,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import PageHeader from '@/components/fabrika/PageHeader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Status = {
  provider: 'WAHA';
  configured: boolean;
  connectionStatus: string;
  connectedPhone: string | null;
  connectedProfileName: string | null;
  lastConnectedAt: string | null;
  lastHealthCheckAt: string | null;
  lastError: string | null;
  autoReplyEnabled: boolean;
  allowFirstContact: boolean;
  dailyMessageLimit: number;
  queue?: Record<string, number>;
};

type ConnectionResponse = Status & {
  qrCode?: string | null;
  pairingCode?: string | null;
  error?: string;
};

const emptyStatus: Status = {
  provider: 'WAHA',
  configured: false,
  connectionStatus: 'DISCONNECTED',
  connectedPhone: null,
  connectedProfileName: null,
  lastConnectedAt: null,
  lastHealthCheckAt: null,
  lastError: null,
  autoReplyEnabled: true,
  allowFirstContact: false,
  dailyMessageLimit: 80,
};

function statusLabel(status: string) {
  switch (status) {
    case 'CONNECTED':
      return 'Bağlı';
    case 'WAITING_QR':
      return 'QR bekleniyor';
    case 'CONNECTING':
      return 'Bağlanıyor';
    case 'PASSKEY_REQUIRED':
      return 'Telefonda güvenlik onayı bekleniyor';
    case 'PASSKEY_CONFIRMATION_REQUIRED':
      return 'Güvenlik kodu onayı bekleniyor';
    case 'ERROR':
      return 'Hata';
    default:
      return 'Bağlı değil';
  }
}

export default function WhatsAppConnectionPanel() {
  const [status, setStatus] = useState<Status>(emptyStatus);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const loadStatus = useCallback(async (refresh = false) => {
    const response = await fetch('/api/fabrika/whatsapp/connection', {
      method: refresh ? 'POST' : 'GET',
      headers: refresh ? { 'Content-Type': 'application/json' } : undefined,
      body: refresh ? JSON.stringify({ action: 'refresh' }) : undefined,
      cache: 'no-store',
    });
    const data = (await response.json()) as ConnectionResponse;
    if (!response.ok) throw new Error(data.error || 'Durum alınamadı.');
    setStatus((current) => ({ ...current, ...data }));
    if (data.connectionStatus === 'CONNECTED') {
      setQrCode(null);
      setPairingCode(null);
    } else {
      if (data.qrCode) setQrCode(data.qrCode);
      if (data.pairingCode) setPairingCode(data.pairingCode);
    }
    return data;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadStatus()
        .catch((error) =>
          toast.error(error instanceof Error ? error.message : 'Durum alınamadı.')
        )
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadStatus]);

  useEffect(() => {
    if (
      ![
        'WAITING_QR',
        'CONNECTING',
        'PASSKEY_REQUIRED',
        'PASSKEY_CONFIRMATION_REQUIRED',
      ].includes(status.connectionStatus)
    ) {
      return;
    }
    const timer = window.setInterval(() => {
      loadStatus(true).catch(() => null);
    }, 7000);
    return () => window.clearInterval(timer);
  }, [loadStatus, status.connectionStatus]);

  async function prepare() {
    setWorking(true);
    try {
      const response = await fetch('/api/fabrika/whatsapp/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'prepare' }),
      });
      const data = (await response.json()) as ConnectionResponse;
      if (!response.ok) throw new Error(data.error || 'QR oluşturulamadı.');
      setQrCode(data.qrCode || null);
      setPairingCode(data.pairingCode || null);
      setStatus((current) => ({
        ...current,
        provider: data.provider || current.provider,
        connectionStatus: data.connectionStatus || 'WAITING_QR',
        lastError: null,
      }));
      // WAHA yeni başlatılan bir oturumu önce STARTING olarak döndürür.
      // QR bazen birkaç saniye sonra gelir; bildirimi göstermeden önce kısa
      // aralıklarla kontrol ederek kullanıcıya boş bir panel göstermeyiz.
      if (!data.qrCode && data.connectionStatus !== 'CONNECTED') {
        for (let attempt = 0; attempt < 12; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 750));
          const refreshed = await loadStatus(true);
          if (refreshed.qrCode || refreshed.connectionStatus === 'CONNECTED') break;
        }
      }
      toast.success(
        data.connectionStatus === 'CONNECTED'
          ? 'WhatsApp zaten bağlı.'
          : 'QR kod hazır. Telefonda WhatsApp ile hemen taratın.'
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bağlantı kurulamadı.');
    } finally {
      setWorking(false);
    }
  }

  async function saveSettings(next: Partial<Status>) {
    const updated = { ...status, ...next };
    setStatus(updated);
    try {
      const response = await fetch('/api/fabrika/whatsapp/connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'settings',
          autoReplyEnabled: updated.autoReplyEnabled,
          allowFirstContact: updated.allowFirstContact,
          dailyMessageLimit: updated.dailyMessageLimit,
        }),
      });
      const data = (await response.json()) as Status & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Ayar kaydedilemedi.');
      setStatus((current) => ({ ...current, ...data }));
      toast.success('WhatsApp güvenlik ayarları kaydedildi.');
    } catch (error) {
      await loadStatus().catch(() => null);
      toast.error(error instanceof Error ? error.message : 'Ayar kaydedilemedi.');
    }
  }

  async function disconnect() {
    if (!window.confirm('Bu şirket telefonunun WhatsApp bağlantısı kapatılsın mı?')) {
      return;
    }
    setWorking(true);
    try {
      const response = await fetch('/api/fabrika/whatsapp/connection', {
        method: 'DELETE',
      });
      const data = (await response.json()) as Status & { error?: string };
      if (!response.ok) throw new Error(data.error || 'Bağlantı kapatılamadı.');
      setStatus((current) => ({ ...current, ...data }));
      setQrCode(null);
      setPairingCode(null);
      toast.success('WhatsApp bağlantısı kapatıldı.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'İşlem başarısız.');
    } finally {
      setWorking(false);
    }
  }

  const connected = status.connectionStatus === 'CONNECTED';
  const normalizedQr = qrCode?.startsWith('data:')
    ? qrCode
    : qrCode
      ? `data:image/png;base64,${qrCode}`
      : null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Şirket bağlantısı"
        icon={MessageCircle}
        title="WhatsApp Merkezi"
        description="Şirket telefonunu QR kodla bağlayın; Asistan ve Avcı aynı güvenli bağlantıyı kullansın."
        actions={
          <Badge
            className={
              connected
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-300'
            }
          >
            {connected ? (
              <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
            ) : (
              <AlertTriangle className="mr-1 h-3.5 w-3.5" />
            )}
            {statusLabel(status.connectionStatus)}
          </Badge>
        }
      />

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-semibold text-white">
                <Link2 className="h-4 w-4 text-emerald-400" />
                Telefon bağlantısı
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-400">
                WhatsApp uygulamasını telefonda kullanmaya devam edebilirsiniz.
                Jasmine ayrı bir bağlı cihaz olarak çalışır.
              </p>
            </div>
            {!connected && (
              <Button
                className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
                disabled={working || loading}
                onClick={prepare}
              >
                {working ? (
                  <Loader2 className="animate-spin" />
                ) : (
                  <QrCode />
                )}
                QR oluştur
              </Button>
            )}
          </div>

          {loading ? (
            <div className="mt-5 h-56 animate-pulse rounded-xl bg-slate-800/70" />
          ) : normalizedQr ? (
            <div className="mt-5 grid gap-5 rounded-xl border border-slate-800 bg-slate-950/70 p-5 sm:grid-cols-[240px_1fr]">
              <div className="flex items-center justify-center rounded-lg bg-white p-3">
                <Image
                  alt="WhatsApp bağlantı QR kodu"
                  className="h-52 w-52"
                  height={208}
                  priority
                  src={normalizedQr}
                  unoptimized
                  width={208}
                />
              </div>
              <ol className="space-y-3 text-sm leading-6 text-slate-300">
                <li><strong>1.</strong> Telefonda WhatsApp&apos;ı açın.</li>
                <li><strong>2.</strong> Ayarlar → Bağlı Cihazlar&apos;a girin.</li>
                <li><strong>3.</strong> “Cihaz Bağla”ya basıp QR kodu okutun.</li>
                <li><strong>4.</strong> Bu ekran birkaç saniye içinde “Bağlı” olur.</li>
                {pairingCode && (
                  <li className="rounded-lg border border-slate-700 bg-slate-900 p-3">
                    Eşleştirme kodu: <strong className="font-mono text-white">{pairingCode}</strong>
                  </li>
                )}
              </ol>
            </div>
          ) : working && !connected ? (
            <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-emerald-500/30 bg-emerald-500/5 p-6 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-emerald-400" />
              <p className="mt-3 font-medium text-slate-100">QR kod hazırlanıyor</p>
              <p className="mt-1 max-w-md text-sm text-slate-400">
                Güvenli bağlantı oturumu başlatıldı. Kod birkaç saniye içinde burada görünecek.
              </p>
            </div>
          ) : (
            <div className="mt-5 flex min-h-40 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/40 p-6 text-center">
              {connected ? (
                <>
                  <Phone className="h-8 w-8 text-emerald-400" />
                  <p className="mt-3 font-medium text-white">
                    {status.connectedProfileName || 'Şirket telefonu'} bağlı
                  </p>
                  <p className="mt-1 text-sm text-slate-400">
                    {status.connectedPhone || 'Telefon numarası güvenli biçimde gizlendi.'}
                  </p>
                </>
              ) : (
                <>
                  <QrCode className="h-8 w-8 text-slate-500" />
                  <p className="mt-3 font-medium text-slate-200">
                    Henüz telefon bağlanmadı
                  </p>
                  <p className="mt-1 max-w-md text-sm text-slate-500">
                    QR oluşturduğunuzda yalnızca bu şirkete ait izole bir oturum açılır.
                  </p>
                </>
              )}
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <Button
              className="border-slate-700 bg-slate-950 text-slate-200 hover:bg-slate-800"
              disabled={working}
              onClick={() => loadStatus(true).catch((error) => toast.error(error.message))}
              variant="outline"
            >
              <RefreshCw /> Durumu yenile
            </Button>
            {connected && (
              <Button
                disabled={working}
                onClick={disconnect}
                variant="destructive"
              >
                <Power /> Bağlantıyı kes
              </Button>
            )}
          </div>
        </section>

        <section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-400" />
            Güvenlik ve otomasyon
          </h2>
          <div className="mt-5 space-y-4">
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <span>
                <span className="block text-sm font-medium text-slate-100">AI otomatik yanıt</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Asistan yeni müşteri mesajlarına onaylı şirket verileriyle yanıt verir.</span>
              </span>
              <input
                aria-label="AI otomatik yanıt"
                checked={status.autoReplyEnabled}
                className="mt-1 h-4 w-4 accent-emerald-500"
                onChange={(event) => saveSettings({ autoReplyEnabled: event.target.checked })}
                type="checkbox"
              />
            </label>
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <span>
                <span className="block text-sm font-medium text-slate-100">Avcı ilk temas gönderimi</span>
                <span className="mt-1 block text-xs leading-5 text-slate-500">Daha önce yazmayan ilan sahiplerine mesaj izni. Düşük limit ve insan onayı önerilir.</span>
              </span>
              <input
                aria-label="Avcı ilk temas gönderimi"
                checked={status.allowFirstContact}
                className="mt-1 h-4 w-4 accent-emerald-500"
                onChange={(event) => saveSettings({ allowFirstContact: event.target.checked })}
                type="checkbox"
              />
            </label>
            <label className="block rounded-lg border border-slate-800 bg-slate-950/50 p-4">
              <span className="text-sm font-medium text-slate-100">Günlük güvenli gönderim limiti</span>
              <Input
                className="mt-3 border-slate-700 bg-slate-900 text-white"
                max={500}
                min={5}
                onBlur={(event) =>
                  saveSettings({
                    dailyMessageLimit: Math.max(5, Math.min(500, Number(event.target.value) || 80)),
                  })
                }
                onChange={(event) =>
                  setStatus((current) => ({
                    ...current,
                    dailyMessageLimit: Number(event.target.value),
                  }))
                }
                type="number"
                value={status.dailyMessageLimit}
              />
            </label>
          </div>
        </section>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {[
          {
            icon: Send,
            label: 'Kuyrukta',
            value: status.queue?.QUEUED || 0,
            detail: 'Bağlantı gelince yeniden denenir',
          },
          {
            icon: CheckCircle2,
            label: 'Gönderildi',
            value: (status.queue?.SENT || 0) + (status.queue?.DELIVERED || 0),
            detail: 'Kayıtlı başarılı gönderim',
          },
          {
            icon: AlertTriangle,
            label: 'Başarısız',
            value: status.queue?.FAILED || 0,
            detail: 'Yeniden inceleme gereken',
          },
        ].map((item) => (
          <div key={item.label} className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
            <item.icon className="h-4 w-4 text-emerald-400" />
            <p className="mt-3 text-2xl font-semibold text-white">{item.value}</p>
            <p className="mt-1 text-sm font-medium text-slate-300">{item.label}</p>
            <p className="mt-1 text-xs text-slate-500">{item.detail}</p>
          </div>
        ))}
      </div>

    </div>
  );
}
