export default function TermsOfUse() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-8">Kullanım Koşulları</h1>
      <div className="prose prose-primary max-w-none text-gray-600">
        {/* TODO: Gerçek hukuki metin eklenecektir. */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 text-yellow-800 text-sm">
          <strong>Not:</strong> Bu sayfa taslak içeriklidir. Gerçek kullanım koşulları avukat onayından sonra buraya eklenmelidir.
        </div>
        
        <p className="mb-4">
          Bu web sitesine erişerek ve siteyi kullanarak, aşağıda belirtilen kullanım koşullarını kabul etmiş sayılırsınız. Eğer bu koşulları kabul etmiyorsanız, lütfen sitemizi kullanmayınız.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. İçerik ve Telif Hakları</h2>
        <p className="mb-4">
          Sitede yer alan tüm metinler, görseller, logolar ve diğer içerikler Jasmine Proje Pazarlama'ya aittir veya lisanslı olarak kullanılmaktadır. İzinsiz kopyalanamaz, çoğaltılamaz ve ticari amaçla kullanılamaz.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. Sorumluluk Reddi</h2>
        <p className="mb-4">
          Sitede yer alan projeler, fiyatlar ve kat planları bilgilendirme amaçlıdır. Jasmine Proje Pazarlama, önceden haber vermeksizin projelerde ve fiyatlarda değişiklik yapma hakkını saklı tutar. Kesin bilgi için satış ofisimizle iletişime geçilmelidir.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Dış Bağlantılar</h2>
        <p className="mb-4">
          Web sitemizden üçüncü taraf sitelere verilen bağlantılardaki içeriklerden Jasmine Proje Pazarlama sorumlu tutulamaz.
        </p>
      </div>
    </div>
  );
}
