'use client';

import { FormEvent, useState } from 'react';
import { Loader2, Send, ShieldCheck } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

type VerificationSubject = 'MEMBER' | 'OWNER';

type VerificationChallenge = {
  challengeId: string;
  expiresAt: string;
  deliveryStatus: string;
};

type Props = {
  subjectType: VerificationSubject;
  memberId?: string;
  phone: string;
  buttonLabel?: string;
  disabled?: boolean;
  onVerified: () => void | Promise<void>;
};

function deliveryLabel(status: string) {
  const labels: Record<string, string> = {
    QUEUED: 'Gönderim sırasında',
    SENT: 'Gönderildi',
    DELIVERED: 'Teslim edildi',
    FAILED: 'Gönderilemedi',
  };
  return labels[status] || 'Kod hazırlandı';
}

function expiryLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'kısa süre içinde';
  return new Intl.DateTimeFormat('tr-TR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export default function PhoneVerificationControl({
  subjectType,
  memberId,
  phone,
  buttonLabel = 'Doğrulama kodu gönder',
  disabled = false,
  onVerified,
}: Props) {
  const [challenge, setChallenge] =
    useState<VerificationChallenge | null>(null);
  const [code, setCode] = useState('');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<'request' | 'confirm' | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function requestCode() {
    if (busy || disabled) return;
    setBusy('request');
    setError(null);
    try {
      const response = await fetch('/api/fabrika/phone-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          subjectType,
          ...(memberId ? { memberId } : {}),
        }),
      });
      const data = (await response.json()) as Partial<VerificationChallenge> & {
        success?: boolean;
        error?: string;
      };
      if (
        !response.ok ||
        !data.success ||
        !data.challengeId ||
        !data.expiresAt ||
        !data.deliveryStatus
      ) {
        throw new Error(data.error || 'Doğrulama kodu gönderilemedi.');
      }
      setChallenge({
        challengeId: data.challengeId,
        expiresAt: data.expiresAt,
        deliveryStatus: data.deliveryStatus,
      });
      setCode('');
      setOpen(true);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Doğrulama kodu gönderilemedi.'
      );
    } finally {
      setBusy(null);
    }
  }

  async function confirmCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!challenge || busy) return;
    if (!/^\d{6}$/.test(code)) {
      setError('Lütfen telefona gelen 6 haneli kodu girin.');
      return;
    }

    setBusy('confirm');
    setError(null);
    try {
      const response = await fetch('/api/fabrika/phone-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'confirm',
          challengeId: challenge.challengeId,
          code,
        }),
      });
      const data = (await response.json()) as {
        success?: boolean;
        verified?: boolean;
        error?: string;
      };
      if (!response.ok || !data.success || !data.verified) {
        throw new Error(data.error || 'Doğrulama kodu onaylanamadı.');
      }
      setOpen(false);
      setChallenge(null);
      setCode('');
      await onVerified();
    } catch (confirmError) {
      setError(
        confirmError instanceof Error
          ? confirmError.message
          : 'Doğrulama kodu onaylanamadı.'
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-1.5">
      <Button
        disabled={disabled || Boolean(busy)}
        onClick={() => void requestCode()}
        size="sm"
        type="button"
        variant="outline"
      >
        {busy === 'request' ? (
          <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
        ) : (
          <Send aria-hidden="true" className="h-4 w-4" />
        )}
        {buttonLabel}
      </Button>
      {!open && error && (
        <p className="max-w-64 text-[11px] leading-4 text-rose-300" role="alert">
          {error}
        </p>
      )}

      <Dialog
        open={open}
        onOpenChange={(nextOpen) => {
          if (busy === 'confirm') return;
          setOpen(nextOpen);
          if (!nextOpen) {
            setChallenge(null);
            setCode('');
            setError(null);
          }
        }}
      >
        <DialogContent className="border border-slate-700 bg-slate-900 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Telefonu doğrula</DialogTitle>
            <DialogDescription className="text-slate-400">
              <span className="font-medium text-slate-200">{phone}</span>{' '}
              numarasına gönderilen 6 haneli, tek kullanımlık kodu girin.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" id="phone-verification-form" onSubmit={confirmCode}>
            <div
              className="rounded-lg border border-slate-700 bg-slate-950 p-3 text-xs text-slate-400"
              id="phone-verification-help"
            >
              <p>
                Durum:{' '}
                <span className="font-medium text-slate-200">
                  {deliveryLabel(challenge?.deliveryStatus || '')}
                </span>
              </p>
              <p className="mt-1">
                Kod {expiryLabel(challenge?.expiresAt || '')} saatine kadar
                geçerlidir.
              </p>
            </div>
            <label className="block text-xs font-medium text-slate-300">
              Doğrulama kodu
              <Input
                aria-describedby="phone-verification-help"
                autoComplete="one-time-code"
                autoFocus
                className="mt-2 h-12 border-slate-700 bg-slate-950 text-center font-mono text-xl tracking-[0.45em] text-white"
                inputMode="numeric"
                maxLength={6}
                onChange={(event) =>
                  setCode(event.target.value.replace(/\D/g, '').slice(0, 6))
                }
                pattern="[0-9]{6}"
                placeholder="000000"
                required
                value={code}
              />
            </label>
            {error && (
              <p className="text-xs leading-5 text-rose-300" role="alert">
                {error}
              </p>
            )}
          </form>
          <DialogFooter>
            <Button
              disabled={busy === 'confirm'}
              onClick={() => setOpen(false)}
              type="button"
              variant="ghost"
            >
              Vazgeç
            </Button>
            <Button
              className="bg-emerald-500 text-emerald-950 hover:bg-emerald-400"
              disabled={busy === 'confirm' || code.length !== 6}
              form="phone-verification-form"
              type="submit"
            >
              {busy === 'confirm' ? (
                <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck aria-hidden="true" className="h-4 w-4" />
              )}
              Kodu doğrula
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
