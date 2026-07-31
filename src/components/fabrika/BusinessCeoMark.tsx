import { Crown } from 'lucide-react';
import { businessCeoBrand } from '@/lib/business-ceo-brand';

export default function BusinessCeoMark({ compact = false }: { compact?: boolean }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-3">
      <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/35 bg-amber-300/10 text-amber-200 shadow-[0_12px_30px_rgba(217,164,92,0.12)]">
        <Crown className="h-5 w-5" aria-hidden="true" />
        <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#08111f] bg-emerald-400" />
      </span>
      {!compact && (
        <span className="min-w-0">
          <span className="block truncate font-serif text-[15px] font-semibold tracking-[0.14em] text-[#f6f1e8]">
            {businessCeoBrand.productName}
          </span>
          <span className="mt-0.5 block text-[9px] font-semibold uppercase tracking-[0.28em] text-[#c99a57]">
            Executive Workspace
          </span>
        </span>
      )}
    </span>
  );
}
