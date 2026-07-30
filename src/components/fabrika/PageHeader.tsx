import type { LucideIcon } from 'lucide-react';

interface PageHeaderProps {
  title: string;
  description: string;
  eyebrow?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}

export default function PageHeader({
  title,
  description,
  eyebrow,
  icon: Icon,
  actions,
}: PageHeaderProps) {
  return (
    <header className="flex flex-col gap-4 border-b border-[#29384d] pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#c99a57]/30 bg-[#c99a57]/10 text-[#e9bd79]">
            <Icon className="h-5 w-5" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0">
          {eyebrow && (
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#c99a57]">
              {eyebrow}
            </p>
          )}
          <h1 className="font-serif text-2xl font-semibold tracking-wide text-[#f6f1e8] sm:text-[30px]">{title}</h1>
          <p className="mt-1.5 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
        </div>
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
