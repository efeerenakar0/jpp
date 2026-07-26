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
    default: 'border-slate-800 bg-slate-900 text-slate-300',
    success: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-300',
    warning: 'border-amber-500/25 bg-amber-500/5 text-amber-300',
  };

  return (
    <section className={`rounded-xl border p-4 ${statusClasses[status]}`}>
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
