'use client';

import { Badge } from '@/components/ui/badge';

export type MediaVariant = 'ORIGINAL' | 'ENHANCED' | 'CREATIVE';

const labels: Record<MediaVariant, string> = {
  ORIGINAL: 'Orijinal',
  ENHANCED: 'AI iyileştirilmiş',
  CREATIVE: 'Temsilî AI',
};

export default function MediaVariantBadge({
  variant,
}: {
  variant: MediaVariant;
}) {
  return (
    <Badge
      className={
        variant === 'CREATIVE'
          ? 'border-amber-400/30 bg-amber-400/10 text-amber-200'
          : variant === 'ENHANCED'
            ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200'
            : 'border-slate-600 bg-slate-800 text-slate-200'
      }
      variant="outline"
    >
      {labels[variant]}
    </Badge>
  );
}
