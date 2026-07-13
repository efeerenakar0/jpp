import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center text-center px-4">
      <div className="text-9xl font-serif font-bold text-primary-100 mb-4">404</div>
      <h1 className="text-3xl font-serif font-bold text-gray-900 mb-4">Sayfa Bulunamadı</h1>
      <p className="text-gray-600 max-w-md mx-auto mb-8">
        Aradığınız sayfa silinmiş, adı değiştirilmiş veya geçici olarak ulaşılamıyor olabilir.
      </p>
      <div className="flex gap-4">
        <Link href="/" className="px-6 py-3 bg-primary-700 text-white font-medium rounded-sm hover:bg-primary-800 transition-colors">
          Ana Sayfaya Dön
        </Link>
        <Link href="/projeler" className="px-6 py-3 bg-white text-primary-700 border border-primary-200 font-medium rounded-sm hover:bg-primary-50 transition-colors">
          Projeleri İncele
        </Link>
      </div>
    </div>
  );
}
