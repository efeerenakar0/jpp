'use client';

import { ExternalLink, ShieldAlert, ShieldCheck, ShieldQuestion } from 'lucide-react';
import { resolveContactPermission } from './portfolio-specialist-data';
import type { HuntingListing } from './types';

const permissionCopy = {
  allowed: { label: 'İletişim izni uygun', icon: ShieldCheck, tone: 'text-emerald-300' },
  denied: { label: 'İletişime kapalı', icon: ShieldAlert, tone: 'text-rose-300' },
  review: { label: 'İzin kontrolü gerekli', icon: ShieldQuestion, tone: 'text-amber-300' },
  missing: { label: 'İletişim kaydı yok', icon: ShieldQuestion, tone: 'text-slate-400' },
} as const;

function dateLabel(value?: string) {
  if (!value) return 'Henüz işlem yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Tarih bilinmiyor';
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

export function ImportedListingsSummary({
  listings,
  periodLabel,
}: {
  listings: HuntingListing[];
  periodLabel?: string;
}) {
  return (
    <section className="rounded-2xl border border-cyan-400/15 bg-slate-950/55 p-4 sm:p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300">
            İçe aktarılan portföyler
          </p>
          <h2 className="mt-1 text-base font-semibold text-white">
            Son keşif kayıtları
            {periodLabel ? ` · ${periodLabel}` : ''}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-400">
            Kaynak, izin ve son işlem bilgileri. Telefon bilgisi bu özet ekranda gösterilmez.
          </p>
        </div>
        <span className="rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-300">
          {listings.length} kayıt
        </span>
      </div>

      {listings.length === 0 ? (
        <div className="mt-4 rounded-xl border border-dashed border-slate-700 p-8 text-center">
          <p className="text-sm font-medium text-slate-200">
            {periodLabel
              ? `${periodLabel} içinde içe aktarılan ilan yok`
              : 'Henüz içe aktarılan ilan yok'}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Filtreli bir arama kuyruğu başlatın veya eklenti paketini yükleyin.
          </p>
        </div>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[760px] table-fixed border-separate border-spacing-0 text-left text-xs">
            <thead>
              <tr className="text-slate-500">
                <th className="w-[38%] border-b border-slate-800 px-3 py-2 font-medium">Portföy</th>
                <th className="w-[16%] border-b border-slate-800 px-3 py-2 font-medium">Kaynak</th>
                <th className="w-[22%] border-b border-slate-800 px-3 py-2 font-medium">İletişim izni</th>
                <th className="w-[14%] border-b border-slate-800 px-3 py-2 font-medium">Durum</th>
                <th className="w-[18%] border-b border-slate-800 px-3 py-2 font-medium">Son işlem</th>
              </tr>
            </thead>
            <tbody>
              {listings.slice(0, 10).map((listing) => {
                const permission = permissionCopy[resolveContactPermission(listing)];
                const PermissionIcon = permission.icon;
                return (
                  <tr className="text-slate-300" key={listing.id}>
                    <td className="border-b border-slate-800/70 px-3 py-3">
                      <a
                        className="inline-flex max-w-full items-center gap-2 font-medium text-slate-100 hover:text-cyan-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300"
                        href={listing.sourceUrl}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <span className="truncate">{listing.title}</span>
                        <ExternalLink className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                      </a>
                      <p className="mt-1 truncate text-[11px] text-slate-500">
                        {listing.location || 'Konum belirtilmedi'}
                      </p>
                    </td>
                    <td className="border-b border-slate-800/70 px-3 py-3">
                      {listing.sourceProvider || 'Dosya aktarımı'}
                    </td>
                    <td className={`border-b border-slate-800/70 px-3 py-3 ${permission.tone}`}>
                      <span className="inline-flex items-center gap-1.5">
                        <PermissionIcon className="h-3.5 w-3.5" aria-hidden="true" />
                        {permission.label}
                      </span>
                    </td>
                    <td className="border-b border-slate-800/70 px-3 py-3">
                      {listing.acquisitionStatus || listing.status}
                    </td>
                    <td className="border-b border-slate-800/70 px-3 py-3 text-slate-400">
                      {dateLabel(listing.updatedAt || listing.lastSeenAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
