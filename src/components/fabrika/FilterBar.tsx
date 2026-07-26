interface FilterBarProps {
  children: React.ReactNode;
  label?: string;
  actions?: React.ReactNode;
}

export default function FilterBar({ children, label = 'Filtreler', actions }: FilterBarProps) {
  return (
    <section
      aria-label={label}
      className="flex flex-col gap-3 rounded-xl border border-slate-800 bg-slate-900 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </section>
  );
}
