export default function CookiePolicy() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-8">Çerez Politikası</h1>
      <div className="prose prose-primary max-w-none text-gray-600">
        {/* TODO: Gerçek hukuki metin eklenecektir. */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 text-yellow-800 text-sm">
          <strong>Not:</strong> Bu sayfa taslak metin içerir. Çerez kullanımına dair teknik detaylar ve hukuksal çerçeve yayın öncesi güncellenmelidir.
        </div>
        
        <p className="mb-4">
          Jasmine Proje Pazarlama web sitesi olarak ziyaretçilerimizin deneyimini iyileştirmek, site kullanımını analiz etmek ve kişiselleştirilmiş içerik sunmak için çerezler (cookies) kullanmaktayız.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Çerez Nedir?</h2>
        <p className="mb-4">
          Çerezler, bir web sitesini ziyaret ettiğinizde tarayıcınız aracılığıyla bilgisayarınıza veya mobil cihazınıza kaydedilen küçük veri dosyalarıdır.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Hangi Çerezleri Kullanıyoruz?</h2>
        <ul className="list-disc pl-5 mb-4 space-y-2">
          <li><strong>Zorunlu Çerezler:</strong> Web sitesinin düzgün çalışması için kesinlikle gerekli olan çerezlerdir. (Örn: Oturum yönetimi)</li>
          <li><strong>Analitik Çerezler:</strong> Ziyaretçilerin siteyi nasıl kullandığını anlamamıza yardımcı olur. (Örn: Google Analytics - Henüz aktif değil, eklenecek)</li>
          <li><strong>Pazarlama Çerezleri:</strong> İlgi alanlarınıza uygun içerik veya reklam sunmak için kullanılır.</li>
        </ul>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Çerezleri Nasıl Yönetebilirsiniz?</h2>
        <p className="mb-4">
          Tarayıcınızın ayarlarını değiştirerek çerezleri reddedebilir veya silebilirsiniz. Ancak zorunlu çerezleri engellemeniz durumunda sitenin bazı işlevleri düzgün çalışmayabilir.
        </p>
      </div>
    </div>
  );
}
