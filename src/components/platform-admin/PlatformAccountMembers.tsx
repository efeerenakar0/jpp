'use client';

import { FormEvent, useState } from 'react';
import {
  Clipboard,
  KeyRound,
  LoaderCircle,
  Plus,
  UserCheck,
  Users,
  UserX,
} from 'lucide-react';

type Member = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  active: boolean;
  username: string | null;
  lastLoginAt: string | null;
};

type Credentials = {
  username: string;
  temporaryCode: string;
};

export default function PlatformAccountMembers({
  accountId,
  companyName,
}: {
  accountId: string;
  companyName: string;
}) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [username, setUsername] = useState('');

  async function loadMembers() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(
        `/api/platform-admin/accounts/members?accountId=${encodeURIComponent(accountId)}`,
        { cache: 'no-store' }
      );
      const data = (await response.json()) as {
        members?: Member[];
        error?: string;
      };
      if (!response.ok || !data.members) {
        throw new Error(data.error || 'Çalışanlar yüklenemedi.');
      }
      setMembers(data.members);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Çalışanlar yüklenemedi.'
      );
    } finally {
      setLoading(false);
    }
  }

  async function toggleOpen() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) {
      await loadMembers();
    }
  }

  async function createMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving('create');
    setError('');
    try {
      const response = await fetch('/api/platform-admin/accounts/members', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, name, email, phone, username }),
      });
      const data = (await response.json()) as {
        members?: Member[];
        oneTimeCredentials?: Credentials;
        error?: string;
      };
      if (!response.ok || !data.members || !data.oneTimeCredentials) {
        throw new Error(data.error || 'Çalışan oluşturulamadı.');
      }
      setMembers(data.members);
      setCredentials(data.oneTimeCredentials);
      setName('');
      setEmail('');
      setPhone('');
      setUsername('');
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Çalışan oluşturulamadı.'
      );
    } finally {
      setSaving(null);
    }
  }

  async function updateMember(
    memberId: string,
    payload:
      | { action: 'reset_credentials' }
      | { action: 'set_active'; active: boolean }
  ) {
    setSaving(memberId);
    setError('');
    try {
      const response = await fetch('/api/platform-admin/accounts/members', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId, memberId, ...payload }),
      });
      const data = (await response.json()) as {
        members?: Member[];
        oneTimeCredentials?: Credentials;
        error?: string;
      };
      if (!response.ok || !data.members) {
        throw new Error(data.error || 'Çalışan güncellenemedi.');
      }
      setMembers(data.members);
      if (data.oneTimeCredentials) {
        setCredentials(data.oneTimeCredentials);
      }
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : 'Çalışan güncellenemedi.'
      );
    } finally {
      setSaving(null);
    }
  }

  return (
    <div className="mt-4 border-t border-slate-800 pt-4">
      <button
        aria-expanded={open}
        className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-200 transition hover:border-cyan-400/40 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
        onClick={toggleOpen}
        type="button"
      >
        <Users className="h-4 w-4" aria-hidden="true" />
        {open ? 'Ekip yönetimini kapat' : 'Çalışanları yönet'}
      </button>

      {open ? (
        <section
          aria-label={`${companyName} çalışan hesapları`}
          className="mt-4 space-y-4 rounded-2xl border border-slate-800 bg-slate-900/40 p-4"
        >
          {credentials ? (
            <div
              aria-live="polite"
              className="rounded-xl border border-amber-400/25 bg-amber-400/10 p-4"
            >
              <p className="text-xs font-black uppercase tracking-wide text-amber-200">
                Bir kez gösterilen çalışan bilgileri
              </p>
              {[
                ['Kullanıcı adı', credentials.username],
                ['Geçici giriş kodu', credentials.temporaryCode],
              ].map(([label, value]) => (
                <div
                  className="mt-3 flex items-center justify-between gap-3"
                  key={label}
                >
                  <div>
                    <p className="text-[10px] text-amber-100/70">{label}</p>
                    <p className="font-mono text-sm font-bold text-white">
                      {value}
                    </p>
                  </div>
                  <button
                    aria-label={`${label} bilgisini kopyala`}
                    className="rounded-lg p-2 text-amber-100 hover:bg-amber-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
                    onClick={() => navigator.clipboard.writeText(value)}
                    type="button"
                  >
                    <Clipboard className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              ))}
              <button
                className="mt-3 text-xs font-bold text-amber-100 underline underline-offset-4"
                onClick={() => setCredentials(null)}
                type="button"
              >
                Bilgileri kaydettim
              </button>
            </div>
          ) : null}

          <form
            className="grid gap-3 md:grid-cols-2"
            onSubmit={createMember}
          >
            <label className="text-xs font-bold text-slate-300">
              Ad soyad
              <input
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/25"
                onChange={(event) => setName(event.target.value)}
                required
                value={name}
              />
            </label>
            <label className="text-xs font-bold text-slate-300">
              Kısa kullanıcı adı
              <input
                autoCapitalize="none"
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/25"
                onChange={(event) => setUsername(event.target.value)}
                placeholder="ayse-yilmaz"
                spellCheck={false}
                value={username}
              />
            </label>
            <label className="text-xs font-bold text-slate-300">
              E-posta
              <input
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/25"
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                value={email}
              />
            </label>
            <label className="text-xs font-bold text-slate-300">
              Telefon
              <input
                className="mt-1.5 min-h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-white outline-none focus-visible:border-cyan-400 focus-visible:ring-2 focus-visible:ring-cyan-400/25"
                onChange={(event) => setPhone(event.target.value)}
                value={phone}
              />
            </label>
            <button
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-cyan-400 px-4 py-2 text-xs font-black text-slate-950 hover:bg-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-200 disabled:opacity-60 md:col-span-2"
              disabled={saving === 'create'}
              type="submit"
            >
              {saving === 'create' ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin motion-reduce:animate-none"
                  aria-hidden="true"
                />
              ) : (
                <Plus className="h-4 w-4" aria-hidden="true" />
              )}
              Çalışan hesabı oluştur
            </button>
          </form>

          {error ? (
            <p
              className="rounded-lg border border-rose-400/25 bg-rose-400/10 p-3 text-xs text-rose-200"
              role="alert"
            >
              {error}
            </p>
          ) : null}

          {loading ? (
            <div className="flex min-h-20 items-center justify-center">
              <LoaderCircle
                className="h-6 w-6 animate-spin text-cyan-300 motion-reduce:animate-none"
                aria-label="Çalışanlar yükleniyor"
              />
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-950/70 p-3 sm:flex-row sm:items-center"
                  key={member.id}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-white">
                      {member.name}
                    </p>
                    <p className="truncate font-mono text-[11px] text-cyan-300">
                      {member.username || 'Giriş bilgisi oluşturulmadı'}
                    </p>
                  </div>
                  <span
                    className={`w-fit rounded-full border px-2 py-1 text-[10px] font-bold ${
                      member.active
                        ? 'border-emerald-400/25 bg-emerald-400/10 text-emerald-300'
                        : 'border-rose-400/25 bg-rose-400/10 text-rose-300'
                    }`}
                  >
                    {member.active ? 'Aktif' : 'Kapalı'}
                  </span>
                  <div className="flex gap-2">
                    <button
                      aria-label={`${member.name} giriş kodunu yenile`}
                      className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
                      disabled={saving === member.id}
                      onClick={() =>
                        updateMember(member.id, {
                          action: 'reset_credentials',
                        })
                      }
                      title="Giriş kodunu yenile"
                      type="button"
                    >
                      <KeyRound className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      aria-label={`${member.name} hesabını ${member.active ? 'kapat' : 'aç'}`}
                      className="rounded-lg border border-slate-700 bg-slate-900 p-2 text-slate-300 hover:text-cyan-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:opacity-60"
                      disabled={saving === member.id}
                      onClick={() =>
                        updateMember(member.id, {
                          action: 'set_active',
                          active: !member.active,
                        })
                      }
                      title={member.active ? 'Hesabı kapat' : 'Hesabı aç'}
                      type="button"
                    >
                      {member.active ? (
                        <UserX className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <UserCheck className="h-4 w-4" aria-hidden="true" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
