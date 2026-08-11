'use client';

import React, { useState } from 'react';
import {
  BadgeCheck,
  Trash2,
  ExternalLink,
  Clock,
  CheckCircle2,
  Loader2,
  XCircle,
  Search,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import ConfirmDialog from './ConfirmDialog';
import EmptyState from './EmptyState';
import FilterBar from './FilterBar';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';

type HuntingStatus = 'YELLOW' | 'AUTHORIZED' | 'RED' | 'GREEN';

interface Listing {
  id: string;
  title: string;
  price?: string | null;
  location?: string | null;
  sourceUrl: string;
  status: HuntingStatus;
  ownerName?: string | null;
  authorizationNote?: string | null;
  eliminationReason?: string | null;
  eliminationSummary?: string | null;
  portfolioImport?: {
    id: string;
    status: string;
    propertyId: string | null;
    reviewNote: string | null;
  } | null;
}

interface StatusBoardProps {
  listings: Listing[];
  onStatusChange: (
    id: string,
    newStatus: HuntingStatus,
    details?: {
      eliminationReason?: string;
      eliminationNote?: string;
      authorizationNote?: string;
    }
  ) => void | Promise<void>;
  onPortfolioJoin: (listingId: string, portfolioImportId: string) => Promise<void>;
  onDeleteListing?: (id: string) => void;
}

export default function StatusBoard({
  listings,
  onStatusChange,
  onPortfolioJoin,
  onDeleteListing,
}: StatusBoardProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [eliminating, setEliminating] = useState<Listing | null>(null);
  const [joiningId, setJoiningId] = useState<string | null>(null);

  const filtered = listings.filter((l) => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return (
      l.title.toLowerCase().includes(term) ||
      (l.location && l.location.toLowerCase().includes(term)) ||
      (l.ownerName && l.ownerName.toLowerCase().includes(term))
    );
  });

  const yellowListings = filtered.filter((l) => l.status === 'YELLOW');
  const authorizedListings = filtered.filter(
    (l) => l.status === 'AUTHORIZED'
  );
  const redListings = filtered.filter((l) => l.status === 'RED');
  const greenListings = filtered.filter((l) => l.status === 'GREEN');

  const renderColumn = ({
    title, 
    badgeText,
    badgeBg,
    borderColor,
    items, 
    targetStatuses,
    icon: Icon
  }: { 
    title: string; 
    badgeText: string;
    badgeBg: string;
    borderColor: string;
    items: Listing[];
    targetStatuses: { label: string; status: HuntingStatus; btnClass: string }[];
    icon: LucideIcon;
  }) => (
    <section className={`flex h-full flex-col rounded-xl border bg-slate-900 p-4 ${borderColor}`}>
      <div className="flex items-center justify-between pb-4 border-b border-slate-800/80 mb-4">
        <div className="flex items-center gap-2.5">
          <div className={`p-2 rounded-xl ${badgeBg} flex items-center justify-center`}>
            <Icon className="w-4 h-4" />
          </div>
          <h3 className="font-black text-white text-sm tracking-wide">{title}</h3>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-black ${badgeBg}`}>
          {items.length} {badgeText}
        </span>
      </div>
      
      <div className="flex-1 overflow-y-auto space-y-3.5 pr-1.5 custom-scrollbar min-h-[450px] max-h-[600px]">
        {items.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Bu sütunda ilan yok"
            description="Yeni kayıtlar eklendiğinde burada görüntülenecek."
          />
        ) : (
          items.map((listing) => (
            <div 
              key={listing.id} 
              className="relative bg-slate-900/90 border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-4 transition-all duration-200 group hover:shadow-xl hover:shadow-amber-500/5 flex flex-col justify-between"
            >
              {onDeleteListing && (
                <div className="absolute right-3.5 top-3.5">
                  <ConfirmDialog
                    trigger={
                      <button
                        type="button"
                        className="rounded-lg bg-rose-500/10 p-1.5 text-rose-400 opacity-100 transition-colors hover:bg-rose-500/20 sm:opacity-0 sm:group-hover:opacity-100"
                        title="İlanı sil"
                        aria-label={`${listing.title} ilanını sil`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    }
                    title="İlan silinsin mi?"
                    description="Bu kayıt durum panosundan kaldırılacak. Bu işlem geri alınamaz."
                    confirmLabel="İlanı sil"
                    destructive
                    onConfirm={() => onDeleteListing(listing.id)}
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between text-[11px] mb-2 pr-6">
                  <span className="font-mono text-amber-400 font-bold bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded-lg">
                    {listing.price || 'Fiyat Yok'}
                  </span>
                  {listing.location && (
                    <span className="text-slate-400 font-medium truncate max-w-[120px]">
                      📍 {listing.location}
                    </span>
                  )}
                </div>

                <h4 className="font-extrabold text-white text-xs leading-snug line-clamp-2 mb-3 pr-4 group-hover:text-amber-300 transition-colors" title={listing.title}>
                  {listing.title}
                </h4>

                {listing.ownerName && (
                  <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-800/80 mb-3 space-y-1 text-[11px]">
                    <p className="text-slate-300 font-bold flex items-center gap-1.5">
                      <span className="text-slate-500">Malik:</span>{' '}
                      {listing.ownerName}
                    </p>
                  </div>
                )}

                {listing.status === 'AUTHORIZED' && (
                  <div className="mb-3 rounded-xl border border-sky-500/20 bg-sky-500/5 p-2.5 text-[11px] leading-5 text-sky-200">
                    <p className="font-semibold">
                      {listing.portfolioImport?.status === 'APPROVED'
                        ? 'Portföye onaylandı'
                        : 'Portföy onayı bekleniyor'}
                    </p>
                    {listing.authorizationNote && (
                      <p className="mt-1 text-sky-300/80">
                        {listing.authorizationNote}
                      </p>
                    )}
                  </div>
                )}

                {listing.status === 'RED' && listing.eliminationSummary && (
                  <div className="mb-3 rounded-xl border border-rose-500/20 bg-rose-500/5 p-2.5 text-[11px] leading-5 text-rose-200">
                    <p className="font-semibold">Eleme özeti</p>
                    <p className="mt-1 text-rose-300/80">
                      {listing.eliminationSummary}
                    </p>
                  </div>
                )}
              </div>

              <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-2 mt-2">
                <a 
                  href={listing.sourceUrl} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-400 hover:text-amber-300 transition-colors"
                >
                  İlana Git <ExternalLink className="w-3 h-3" />
                </a>

                <div className="flex gap-1.5">
                  {targetStatuses.map((ts) => (
                    <button
                      disabled={
                        joiningId === listing.id ||
                        (ts.status === 'GREEN' && !listing.portfolioImport?.id)
                      }
                      key={ts.status}
                      onClick={async () => {
                        if (ts.status === 'RED') {
                          setEliminating(listing);
                          return;
                        }
                        if (ts.status === 'GREEN') {
                          if (!listing.portfolioImport?.id) return;
                          setJoiningId(listing.id);
                          try {
                            await onPortfolioJoin(
                              listing.id,
                              listing.portfolioImport.id
                            );
                          } finally {
                            setJoiningId(null);
                          }
                          return;
                        }
                        void onStatusChange(listing.id, ts.status);
                      }}
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer border active:scale-95 disabled:cursor-not-allowed disabled:opacity-50 ${ts.btnClass}`}
                      title={
                        ts.status === 'GREEN' && !listing.portfolioImport?.id
                          ? 'Önce satış yetkisi onay kaydı oluşturulmalı.'
                          : undefined
                      }
                      type="button"
                    >
                      {ts.status === 'GREEN' && joiningId === listing.id && (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      )}
                      {ts.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );

  return (
    <div className="space-y-6">
      {/* Filter / Search Bar */}
      <FilterBar label="İlan arama ve durum açıklamaları">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="İlan başlığı, konum veya malik adı ara..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-amber-500/50 transition-colors"
          />
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-400 font-semibold">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> Sıcak İlanlar</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Satış Yetkisi</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Portföye Katıldı</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-400" /> Pasif</span>
        </div>
      </FilterBar>

      {/* Grid Columns */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 2xl:grid-cols-4">
        {renderColumn({
          title: 'Görüşmesi sürenler',
          badgeText: 'Aday',
          badgeBg: 'bg-amber-500/20 text-amber-300 border border-amber-500/30',
          borderColor: 'border-amber-500/20',
          items: yellowListings,
          icon: Sparkles,
          targetStatuses: [
            { label: 'Elendi', status: 'RED', btnClass: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' },
            { label: 'Satış Yetkisi Alındı', status: 'AUTHORIZED', btnClass: 'bg-sky-500/20 border-sky-500/30 text-sky-300 hover:bg-sky-500/30' }
          ],
        })}
        {renderColumn({
          title: 'Satış Yetkisi alınmaya hazır',
          badgeText: 'Onay',
          badgeBg: 'bg-sky-500/20 text-sky-300 border border-sky-500/30',
          borderColor: 'border-sky-500/20',
          items: authorizedListings,
          icon: BadgeCheck,
          targetStatuses: [
            { label: 'Portföyümüze Kat', status: 'GREEN', btnClass: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/25' },
            { label: 'Pazarlığa Döndür', status: 'YELLOW', btnClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' },
            { label: 'Elendi', status: 'RED', btnClass: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' },
          ],
        })}
        {renderColumn({
          title: 'Portföyümüze Katıldı',
          badgeText: 'İlan',
          badgeBg: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30',
          borderColor: 'border-emerald-500/20',
          items: greenListings,
          icon: CheckCircle2,
          targetStatuses: [
            { label: 'Pazarlığa Al', status: 'YELLOW', btnClass: 'bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20' },
            { label: 'Pasif', status: 'RED', btnClass: 'bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20' }
          ],
        })}
        {renderColumn({
          title: 'Pasif / Elendi',
          badgeText: 'İlan',
          badgeBg: 'bg-red-500/20 text-red-300 border border-red-500/30',
          borderColor: 'border-red-500/20',
          items: redListings,
          icon: XCircle,
          targetStatuses: [
            { label: 'Yeniden Pazarlığa Al', status: 'YELLOW', btnClass: 'bg-amber-500/20 border-amber-500/30 text-amber-300 hover:bg-amber-500/30' }
          ],
        })}
      </div>

      <Dialog
        onOpenChange={(open) => !open && setEliminating(null)}
        open={Boolean(eliminating)}
      >
        <DialogContent className="max-w-md border-slate-700 bg-slate-900 text-slate-100">
          <DialogHeader>
            <DialogTitle>İlan neden elendi?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Yapılandırılmış neden raporlarda kullanılacak; AI yalnızca
              verdiğiniz bilgileri kısa bir özete dönüştürecek.
            </DialogDescription>
          </DialogHeader>
          <form
            className="space-y-4"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!eliminating) return;
              const form = new FormData(event.currentTarget);
              await onStatusChange(eliminating.id, 'RED', {
                eliminationReason: String(form.get('reason') || ''),
                eliminationNote: String(form.get('note') || ''),
              });
              setEliminating(null);
            }}
          >
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Eleme nedeni</span>
              <select
                className="h-10 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-sm text-slate-100 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                defaultValue=""
                name="reason"
                required
              >
                <option disabled value="">
                  Neden seçin
                </option>
                <option value="OTHER_AGENT">Başka emlakçıyla anlaştı</option>
                <option value="AUTHORITY_GIVEN">
                  Yetkiyi başka firmaya verdi
                </option>
                <option value="OWNER_WITHDREW">Satıştan vazgeçti</option>
                <option value="PRICE_DISAGREEMENT">
                  Fiyat veya koşullarda anlaşılamadı
                </option>
                <option value="UNREACHABLE">Tekrar ulaşılamadı</option>
                <option value="DUPLICATE">Mükerrer kayıt</option>
                <option value="OTHER">Diğer</option>
              </select>
            </label>
            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Danışman notu — isteğe bağlı</span>
              <Textarea
                className="min-h-24 border-slate-700 bg-slate-950 text-slate-100"
                name="note"
                placeholder="Görüşmede geçen doğrulanmış ayrıntıyı yazın..."
              />
            </label>
            <DialogFooter className="border-slate-700 bg-slate-950/60">
              <Button
                onClick={() => setEliminating(null)}
                type="button"
                variant="outline"
              >
                Vazgeç
              </Button>
              <Button
                className="bg-rose-500 text-white hover:bg-rose-400"
                type="submit"
              >
                Elendi olarak kaydet
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
