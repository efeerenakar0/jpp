'use client';

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  Check,
  Clipboard,
  ExternalLink,
  FileText,
  ImageIcon,
  LoaderCircle,
  MapPin,
  MessageSquareText,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Button } from '@/components/ui/button';
import {
  CONTACT_REASON_LABELS,
  CONTACT_STATUS_META,
  contactUiStatus,
} from './contact-status';
import type {
  HuntingContactSummary,
  HuntingListingDetail,
  HuntingListingsResponse,
} from './types';

async function apiJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || 'İşlem tamamlanamadı.');
  }
  return payload as T;
}

const ADDRESS_LABELS: Record<string, string> = {
  UNKNOWN: 'Konum doğrulanmadı',
  CITY: 'İl düzeyi',
  DISTRICT: 'İlçe düzeyi',
  NEIGHBORHOOD: 'Mahalle düzeyi',
  STREET: 'Sokak düzeyi',
  EXACT: 'Kesin konum',
};

const ACQUISITION_LABELS: Record<string, string> = {
  DISCOVERED: 'Keşfedildi',
  DETAIL_COMPLETE: 'Detay tamamlandı',
  PARTIAL: 'Kısmi veri',
  UNAVAILABLE: 'Erişilemiyor',
  REMOVED: 'Yayından kaldırıldı',
  SOURCE_CHALLENGE: 'Kaynak doğrulaması gerekli',
};

type ListingExplorerProps = {
  jobId: string | null;
  refreshToken: number;
};

export default function ListingExplorer({
  jobId,
  refreshToken,
}: ListingExplorerProps) {
  const [response, setResponse] = useState<HuntingListingsResponse | null>(
    null
  );
  const [detail, setDetail] = useState<HuntingListingDetail | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const manualSendRequestRef = useRef<{ key: string; id: string } | null>(
    null
  );
  const [draftTone, setDraftTone] = useState<'samimi' | 'resmi' | 'acil'>(
    'samimi'
  );

  const loadListings = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: '1', pageSize: '48' });
      if (jobId) params.set('jobId', jobId);
      setResponse(
        await apiJson<HuntingListingsResponse>(
          `/api/fabrika/hunting/listings?${params}`
        )
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İlanlar yüklenemedi.'
      );
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadListings();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadListings, refreshToken]);

  const loadDetail = useCallback(async (listingId: string) => {
    setDetailLoading(true);
    setDraft('');
    try {
      setDetail(
        await apiJson<HuntingListingDetail>(
          `/api/fabrika/hunting/listings/${listingId}`
        )
      );
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İlan detayı yüklenemedi.'
      );
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filteredItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase('tr');
    if (!normalized) return response?.items || [];
    return (response?.items || []).filter((listing) =>
      [
        listing.title,
        listing.province,
        listing.district,
        listing.neighborhood,
      ]
        .filter(Boolean)
        .some((value) =>
          String(value).toLocaleLowerCase('tr').includes(normalized)
        )
    );
  }, [query, response]);

  const activeContact = detail?.contacts[0];
  const activeDecision = activeContact?.policyDecisions[0];
  const activeStatus = contactUiStatus(activeContact);
  const canApprove =
    Boolean(activeContact) &&
    !activeDecision?.allowed &&
    (activeDecision?.reasonCodes.includes('HUMAN_APPROVAL_REQUIRED') ||
      !activeDecision);

  async function refreshDetail() {
    if (!detail) return;
    await loadDetail(detail.id);
    await loadListings();
  }

  async function evaluateContact(contact: HuntingContactSummary) {
    if (!detail) return;
    setActionLoading('evaluate');
    try {
      await apiJson(`/api/fabrika/hunting/contacts/${contact.id}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingId: detail.id,
          channel: 'WHATSAPP',
          purpose: 'SALES_AUTHORITY_DISCUSSION',
        }),
      });
      await refreshDetail();
      toast.success('İletişim izinleri yeniden değerlendirildi.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İzin kontrolü yapılamadı.'
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function approveContact(contact: HuntingContactSummary) {
    if (!detail) return;
    setActionLoading('approve');
    try {
      const result = await apiJson<{
        allowed: boolean;
        reasonCodes: string[];
      }>(`/api/fabrika/hunting/outreach/${detail.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: contact.id,
          channel: 'WHATSAPP',
          purpose: 'SALES_AUTHORITY_DISCUSSION',
        }),
      });
      await refreshDetail();
      if (result.allowed) {
        toast.success('İnsan onayı kaydedildi; iletişim şartları hazır.');
      } else {
        toast.error('Onay kaydedildi fakat diğer izin eksikleri devam ediyor.');
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'İnsan onayı kaydedilemedi.'
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function generateDraft() {
    if (!detail) return;
    setActionLoading('draft');
    try {
      const result = await apiJson<{
        messages: Array<{ message: { content: string } }>;
      }>('/api/fabrika/hunting/bulk-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          listingIds: [detail.id],
          tone: draftTone,
        }),
      });
      const content = result.messages[0]?.message.content;
      if (!content) throw new Error('Taslak üretilemedi.');
      setDraft(content);
      toast.success('AI taslağı hazırlandı; hiçbir mesaj gönderilmedi.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Taslak üretilemedi.'
      );
    } finally {
      setActionLoading(null);
    }
  }

  async function sendApprovedDraft() {
    if (!detail || !activeContact || !draft.trim()) return;
    setActionLoading('send');
    const requestKey = `${detail.id}:${activeContact.id}:${draft.trim()}`;
    if (manualSendRequestRef.current?.key !== requestKey) {
      manualSendRequestRef.current = {
        key: requestKey,
        id: crypto.randomUUID(),
      };
    }
    try {
      await apiJson('/api/whatsapp/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: draft.trim(),
          requestId: manualSendRequestRef.current.id,
          listingId: detail.id,
          huntedContactId: activeContact.id,
          purpose: 'SALES_AUTHORITY_DISCUSSION',
        }),
      });
      manualSendRequestRef.current = null;
      toast.success('Onaylı mesaj güvenli gönderim kuyruğuna alındı.');
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : 'Mesaj kuyruğa alınamadı.'
      );
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <section className="rounded-xl border border-slate-800 bg-slate-900 p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">
            Keşfedilen &amp; İletişim Sürecine Alınan Portföyler
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Galeri, açıklama, tüm özellikler, veri tamlığı ve güvenli iletişim
            durumunu tek ekranda inceleyin.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input
              className="h-9 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-xs text-white outline-none focus:border-emerald-500 sm:w-72"
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Başlık veya konum ara"
              value={query}
            />
          </label>
          <Button
            aria-label="İlanları yenile"
            className="h-9 border-slate-700 bg-slate-950 text-slate-300 hover:bg-slate-800"
            onClick={() => void loadListings()}
            size="icon"
            type="button"
            variant="outline"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <div
              className="h-56 animate-pulse rounded-xl border border-slate-800 bg-slate-950"
              key={item}
            />
          ))}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="mt-5 flex min-h-52 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-950/50 text-center">
          <FileText className="h-8 w-8 text-slate-600" />
          <p className="mt-3 text-sm font-medium text-slate-200">
            Bu filtrede ilan bulunamadı
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Yeni bir av başlatın veya iletişim filtresini değiştirin.
          </p>
        </div>
      ) : (
        <div className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((listing) => {
            const contact = listing.contacts[0];
            const status = contactUiStatus(contact);
            const statusMeta = CONTACT_STATUS_META[status];
            const image =
              listing.images[0]?.storageKey ||
              listing.images[0]?.sourceUrl ||
              listing.imageUrl;
            const location = [
              listing.province,
              listing.district,
              listing.neighborhood,
            ]
              .filter(Boolean)
              .join(' / ');
            return (
              <button
                className="group overflow-hidden rounded-xl border border-slate-800 bg-slate-950 text-left transition hover:border-emerald-500/40 hover:bg-slate-950/70 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                key={listing.id}
                onClick={() => void loadDetail(listing.id)}
                type="button"
              >
                <div className="relative h-32 bg-slate-900">
                  {image ? (
                    <img
                      alt=""
                      className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                      loading="lazy"
                      src={image}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-slate-700" />
                    </div>
                  )}
                  <span
                    className={`absolute left-2.5 top-2.5 rounded-full border px-2 py-1 text-[10px] font-semibold ${statusMeta.className}`}
                  >
                    {statusMeta.label}
                  </span>
                </div>
                <div className="space-y-3 p-3.5">
                  <div>
                    <p className="line-clamp-2 text-sm font-semibold text-white">
                      {listing.title}
                    </p>
                    <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-500">
                      <MapPin className="h-3 w-3" />
                      {location || 'Konum belirtilmedi'}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-semibold text-emerald-300">
                      {listing.price || 'Fiyat belirtilmedi'}
                    </span>
                    <span className="text-[11px] text-slate-400">
                      %{listing.completenessScore} tam
                    </span>
                  </div>
                  <div className="h-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="h-full rounded-full bg-emerald-500"
                      style={{ width: `${listing.completenessScore}%` }}
                    />
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {(detail || detailLoading) && (
        <div
          aria-label="İlan detayı"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3 backdrop-blur-sm"
          role="dialog"
        >
          <div className="relative max-h-[94vh] w-full max-w-6xl overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl">
            <button
              aria-label="İlan detayını kapat"
              className="sticky right-4 top-4 z-20 float-right m-4 rounded-lg border border-slate-700 bg-slate-950 p-2 text-slate-300 hover:bg-slate-800"
              onClick={() => setDetail(null)}
              type="button"
            >
              <X className="h-4 w-4" />
            </button>

            {detailLoading || !detail ? (
              <div className="flex min-h-96 items-center justify-center">
                <LoaderCircle className="h-8 w-8 animate-spin text-emerald-400" />
              </div>
            ) : (
              <div className="grid lg:grid-cols-[minmax(0,1.35fr)_minmax(340px,0.65fr)]">
                <div className="space-y-6 border-slate-800 p-5 lg:border-r lg:p-7">
                  <div className="pr-12">
                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full border border-slate-700 bg-slate-950 px-2.5 py-1 text-[10px] text-slate-300">
                        {ACQUISITION_LABELS[detail.acquisitionStatus] ||
                          detail.acquisitionStatus}
                      </span>
                      <span className="rounded-full border border-sky-500/20 bg-sky-500/10 px-2.5 py-1 text-[10px] text-sky-300">
                        {ADDRESS_LABELS[detail.addressPrecision] ||
                          detail.addressPrecision}
                      </span>
                    </div>
                    <h3 className="mt-3 text-xl font-semibold text-white">
                      {detail.title}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-400">
                      <span className="font-semibold text-emerald-300">
                        {detail.price || 'Fiyat belirtilmedi'}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3.5 w-3.5" />
                        {[
                          detail.province,
                          detail.district,
                          detail.neighborhood,
                          detail.street,
                        ]
                          .filter(Boolean)
                          .join(' / ') || 'Konum belirtilmedi'}
                      </span>
                      <a
                        className="inline-flex items-center gap-1 text-sky-300 hover:text-sky-200"
                        href={detail.sourceUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        Kaynağı aç <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">
                        Görsel galerisi
                      </h4>
                      <span className="text-[11px] text-slate-500">
                        {detail.images.length} görsel
                      </span>
                    </div>
                    {detail.images.length ? (
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                        {detail.images.map((image) => (
                          <a
                            className="overflow-hidden rounded-lg border border-slate-800 bg-slate-950 focus:ring-2 focus:ring-emerald-500/30"
                            href={image.storageKey || image.sourceUrl}
                            key={image.id}
                            rel="noopener noreferrer"
                            target="_blank"
                          >
                            <img
                              alt={`${detail.title} görsel ${image.order + 1}`}
                              className="aspect-[4/3] h-full w-full object-cover"
                              loading="lazy"
                              src={image.storageKey || image.sourceUrl}
                            />
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="flex h-32 items-center justify-center rounded-lg border border-dashed border-slate-700 bg-slate-950 text-xs text-slate-500">
                        Görsel bulunamadı
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <h4 className="text-sm font-semibold text-white">
                      İlan açıklaması
                    </h4>
                    <p className="mt-3 whitespace-pre-wrap text-xs leading-6 text-slate-300">
                      {detail.descriptionText || 'Açıklama bulunamadı.'}
                    </p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-white">
                      Bütün özellikler
                    </h4>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2">
                      {Object.entries(detail.attributesJson || {}).length ? (
                        Object.entries(detail.attributesJson || {}).map(
                          ([key, value]) => (
                            <div
                              className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2.5"
                              key={key}
                            >
                              <dt className="text-xs text-slate-500">{key}</dt>
                              <dd className="text-right text-xs font-medium text-slate-200">
                                {String(value)}
                              </dd>
                            </div>
                          )
                        )
                      ) : (
                        <div className="rounded-lg border border-dashed border-slate-700 p-4 text-xs text-slate-500 sm:col-span-2">
                          Yapılandırılmış özellik bulunamadı.
                        </div>
                      )}
                    </dl>
                  </div>
                </div>

                <aside className="space-y-5 bg-slate-950/50 p-5 lg:p-7">
                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-white">
                        Veri tamlığı
                      </h4>
                      <span className="text-lg font-semibold text-emerald-300">
                        %{detail.completenessScore}
                      </span>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${detail.completenessScore}%` }}
                      />
                    </div>
                    <p className="mt-3 text-[11px] leading-5 text-slate-500">
                      Eksik konum veya özellikler tahmin edilmez; yalnızca
                      kaynaktan doğrulanan alanlar gösterilir.
                    </p>
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <h4 className="text-sm font-semibold text-white">
                        İletişim uygunluğu
                      </h4>
                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-semibold ${CONTACT_STATUS_META[activeStatus].className}`}
                      >
                        {CONTACT_STATUS_META[activeStatus].label}
                      </span>
                    </div>

                    {!activeContact ? (
                      <div className="mt-4 flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-900 p-3 text-xs leading-5 text-slate-400">
                        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                        Crawlee telefon toplamaz. Doğrulanmış bir
                        ContactProvider kaydı gelene kadar iletişim kapalıdır.
                      </div>
                    ) : (
                      <div className="mt-4 space-y-3">
                        <div className="rounded-lg border border-slate-800 bg-slate-900 p-3">
                          <p className="text-[10px] uppercase tracking-wider text-slate-500">
                            Maskeli telefon
                          </p>
                          <p className="mt-1 font-mono text-sm font-semibold text-white">
                            {activeContact.maskedPhone}
                          </p>
                          <p className="mt-1 text-[11px] text-slate-500">
                            Kaynak: {activeContact.sourceType}
                          </p>
                        </div>

                        {activeDecision?.reasonCodes.length ? (
                          <ul className="space-y-2">
                            {activeDecision.reasonCodes.map((reason) => (
                              <li
                                className="flex items-start gap-2 text-[11px] leading-5 text-amber-200"
                                key={reason}
                              >
                                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                                <span>
                                  {CONTACT_REASON_LABELS[reason] || reason}
                                  <code className="ml-1 text-[9px] text-slate-500">
                                    {reason}
                                  </code>
                                </span>
                              </li>
                            ))}
                          </ul>
                        ) : activeDecision?.allowed ? (
                          <div className="flex items-start gap-2 text-xs leading-5 text-emerald-200">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" />
                            Telefon, amaç, kanal izni, ret ve insan onayı
                            kontrolleri geçerli.
                          </div>
                        ) : (
                          <p className="text-xs leading-5 text-slate-400">
                            Kayıt için henüz politika değerlendirmesi yapılmadı.
                          </p>
                        )}

                        <div className="grid gap-2">
                          <Button
                            className="border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800"
                            disabled={actionLoading === 'evaluate'}
                            onClick={() =>
                              void evaluateContact(activeContact)
                            }
                            type="button"
                            variant="outline"
                          >
                            {actionLoading === 'evaluate' ? (
                              <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <ShieldCheck className="mr-2 h-3.5 w-3.5" />
                            )}
                            İzinleri yeniden kontrol et
                          </Button>
                          <Button
                            className="bg-emerald-500 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500"
                            disabled={
                              !canApprove || actionLoading === 'approve'
                            }
                            onClick={() =>
                              void approveContact(activeContact)
                            }
                            type="button"
                          >
                            {actionLoading === 'approve' ? (
                              <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Check className="mr-2 h-3.5 w-3.5" />
                            )}
                            İnsan onayını kaydet
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl border border-slate-800 bg-slate-950 p-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-violet-300" />
                      <h4 className="text-sm font-semibold text-white">
                        AI mesaj taslağı
                      </h4>
                    </div>
                    <p className="mt-2 text-[11px] leading-5 text-slate-500">
                      AI yalnızca ilan bilgileriyle taslak hazırlar. Oluşturma
                      işlemi mesaj göndermez.
                    </p>
                    <select
                      className="mt-3 h-9 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs text-white"
                      onChange={(event) =>
                        setDraftTone(
                          event.target.value as 'samimi' | 'resmi' | 'acil'
                        )
                      }
                      value={draftTone}
                    >
                      <option value="samimi">Samimi ve profesyonel</option>
                      <option value="resmi">Resmî ve kurumsal</option>
                      <option value="acil">Kısa ve doğrudan</option>
                    </select>
                    <Button
                      className="mt-2 w-full border-violet-500/30 bg-violet-500/10 text-xs text-violet-200 hover:bg-violet-500/20"
                      disabled={actionLoading === 'draft'}
                      onClick={() => void generateDraft()}
                      type="button"
                      variant="outline"
                    >
                      {actionLoading === 'draft' ? (
                        <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <MessageSquareText className="mr-2 h-3.5 w-3.5" />
                      )}
                      Taslak oluştur
                    </Button>

                    {draft && (
                      <div className="mt-3 space-y-2">
                        <textarea
                          aria-label="AI mesaj taslağı"
                          className="min-h-36 w-full resize-y rounded-lg border border-slate-700 bg-slate-900 p-3 text-xs leading-5 text-slate-200 outline-none focus:border-emerald-500"
                          onChange={(event) => setDraft(event.target.value)}
                          value={draft}
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            className="border-slate-700 bg-slate-900 text-xs text-slate-200 hover:bg-slate-800"
                            onClick={() => {
                              void navigator.clipboard.writeText(draft);
                              toast.success('Taslak kopyalandı.');
                            }}
                            type="button"
                            variant="outline"
                          >
                            <Clipboard className="mr-2 h-3.5 w-3.5" />
                            Kopyala
                          </Button>
                          <Button
                            className="bg-emerald-500 text-xs font-semibold text-emerald-950 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500"
                            disabled={
                              activeStatus !== 'READY' ||
                              !activeContact ||
                              actionLoading === 'send'
                            }
                            onClick={() => void sendApprovedDraft()}
                            type="button"
                          >
                            {actionLoading === 'send' ? (
                              <LoaderCircle className="mr-2 h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Send className="mr-2 h-3.5 w-3.5" />
                            )}
                            Onaylı gönder
                          </Button>
                        </div>
                        {activeStatus !== 'READY' && (
                          <p className="flex items-start gap-1.5 text-[10px] leading-4 text-amber-300">
                            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                            İletişim uygunluğu tamamlanmadan gönderim butonu
                            açılamaz.
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </aside>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
