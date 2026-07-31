import type { LucideIcon } from 'lucide-react';

interface StatCardProps {
  label: string;
  value: React.ReactNode;
  icon?: LucideIcon;
  hint?: string;
  status?: 'default' | 'success' | 'warning';
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  status = 'default',
}: StatCardProps) {
  const statusClasses = {
    default: 'border-[#29384d] bg-[#101b2b] text-slate-300',
    success: 'border-emerald-500/25 bg-[#0d1d25] text-emerald-300',
    warning: 'border-[#c99a57]/35 bg-[#1c1a19] text-[#e9bd79]',
  };

  return (
    <section className={`group rounded-xl border p-4 shadow-[0_16px_38px_rgba(0,0,0,0.12)] transition-colors hover:border-[#c99a57]/35 ${statusClasses[status]}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-400">{label}</p>
          <p className="mt-2 text-2xl font-semibold tracking-tight text-white">{value}</p>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        {Icon && (
          <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-current/15 bg-current/10">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
        )}
      </div>
    </section>
  );
}
