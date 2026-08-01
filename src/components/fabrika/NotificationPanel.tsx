import { Bell } from 'lucide-react';
import EmptyState from './EmptyState';

interface NotificationPanelProps {
  title?: string;
  description?: string;
  count?: number;
  children?: React.ReactNode;
}

export default function NotificationPanel({
  title = 'Bildirimler',
  description = 'Operasyon ve sistem güncellemeleri',
  count = 0,
  children,
}: NotificationPanelProps) {
  return (
    <section className="ceo-notification-panel overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
      <div className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-4">
        <div>
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        </div>
        <span className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs font-medium text-slate-300">
          {count}
        </span>
      </div>
      <div className="p-4">
        {children ?? (
          <EmptyState
            icon={Bell}
            title="Yeni bildirim yok"
            description="Yeni bir operasyon olayı oluştuğunda burada görünecek."
          />
        )}
      </div>
    </section>
  );
}
