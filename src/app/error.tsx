"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Log the error to an error reporting service
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="w-20 h-20 bg-red-100 text-red-600 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h1 className="text-3xl font-serif font-bold text-gray-900 mb-4">Bir Şeyler Ters Gitti</h1>
      <p className="text-gray-600 max-w-md mx-auto mb-8">
        Üzgünüz, beklenmeyen bir sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin veya ana sayfaya dönün.
      </p>
      <div className="flex gap-4">
        <button
          onClick={() => reset()}
          className="px-6 py-3 bg-primary-700 text-white font-medium rounded-sm hover:bg-primary-800 transition-colors"
        >
          Tekrar Dene
        </button>
        <Link href="/" className="px-6 py-3 bg-white text-primary-700 border border-primary-200 font-medium rounded-sm hover:bg-primary-50 transition-colors">
          Ana Sayfaya Dön
        </Link>
      </div>
    </div>
  );
}
