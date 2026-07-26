import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  title: string;
  description: string;
  icon: LucideIcon;
  action?: React.ReactNode;
}

export default function EmptyState({ title, description, icon: Icon, action }: EmptyStateProps) {
  return (
    <div className="flex min-h-56 flex-col items-center justify-center rounded-xl border border-dashed border-slate-700 bg-slate-900/50 px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-400">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-white">{title}</h3>
      <p className="mt-1 max-w-md text-sm leading-6 text-slate-400">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
