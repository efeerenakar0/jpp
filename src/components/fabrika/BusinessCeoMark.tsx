import { Crown } from 'lucide-react';
import BusinessCeoLogo from '@/components/common/BusinessCeoLogo';

export default function BusinessCeoMark({
  compact = false,
  priority = false,
}: {
  compact?: boolean;
  priority?: boolean;
}) {
  if (!compact) {
    return (
      <BusinessCeoLogo
        className="w-[168px] sm:w-[198px]"
        priority={priority}
      />
    );
  }

  return (
    <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-300/35 bg-amber-300/10 text-amber-200 shadow-[0_12px_30px_rgba(217,164,92,0.12)]">
      <Crown className="h-5 w-5" aria-hidden="true" />
      <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-[#08111f] bg-emerald-400" />
    </span>
  );
}
