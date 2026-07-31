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
    <header className="ceo-page-header relative flex flex-col gap-5 border-b border-[#29384d] pb-6 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        {(eyebrow || Icon) && (
          <div className="mb-2 flex items-center gap-2 text-[#d8a85f]">
            {Icon && (
              <span className="ceo-page-header-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#c99a57]/25 bg-[#c99a57]/10">
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
              </span>
            )}
            {eyebrow && (
              <p className="text-[10px] font-bold uppercase tracking-[0.24em]">
                {eyebrow}
              </p>
            )}
          </div>
        )}
        <div className="min-w-0">
          <h1 className="business-ceo-display text-[1.8rem] font-medium leading-tight text-[#f6f1e8] sm:text-[2.15rem]">{title}</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-[#98a8bb]">{description}</p>
        </div>
      </div>
      {actions && <div className="ceo-page-actions flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">{actions}</div>}
    </header>
  );
}
