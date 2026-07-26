import { Skeleton } from '@/components/ui/skeleton';

interface LoadingSkeletonProps {
  rows?: number;
}

export default function LoadingSkeleton({ rows = 4 }: LoadingSkeletonProps) {
  return (
    <div className="space-y-3" role="status" aria-label="İçerik yükleniyor">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4">
          <Skeleton className="h-10 w-10 shrink-0 rounded-lg bg-slate-800" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3 w-2/5 bg-slate-800" />
            <Skeleton className="h-3 w-4/5 bg-slate-800" />
          </div>
        </div>
      ))}
      <span className="sr-only">Yükleniyor</span>
    </div>
  );
}
