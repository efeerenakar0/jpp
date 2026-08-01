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
    default: 'border-[#2b3b50] text-slate-300',
    success: 'border-emerald-500/25 text-emerald-300',
    warning: 'border-[#c99a57]/35 text-[#e9bd79]',
  };

  return (
    <section
      className={`ceo-stat-card group relative min-h-[104px] overflow-hidden rounded-xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-[#c99a57]/45 ${statusClasses[status]}`}
      data-status={status}
    >
      <div className="relative z-10 flex h-full items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[#91a1b5]">{label}</p>
          <p className="mt-2 text-[1.7rem] font-semibold leading-none tracking-tight text-[#f8f4ec]">{value}</p>
          {hint && <p className="mt-2 truncate text-[11px] text-[#718198]">{hint}</p>}
        </div>
        {Icon && (
          <span className="ceo-stat-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-current/20 bg-current/10">
            <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
          </span>
        )}
      </div>
    </section>
  );
}
