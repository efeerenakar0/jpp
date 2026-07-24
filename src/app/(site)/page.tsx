'use client';

import { useEffect } from 'react';

export default function Home() {
  useEffect(() => {
    window.location.replace('/fabrika');
  }, []);

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center text-slate-300 font-sans">
      <div className="flex items-center gap-3">
        <div className="w-6 h-6 border-2 border-rose-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-sm font-medium">Jasmine YZ Fabrikasına Yönlendiriliyorsunuz...</span>
      </div>
    </div>
  );
}
