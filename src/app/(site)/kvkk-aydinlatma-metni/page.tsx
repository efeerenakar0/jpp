export default function KVKKPage() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-8">KVKK Aydınlatma Metni</h1>
      <div className="prose prose-primary max-w-none text-gray-600">
        {/* TODO: Gerçek hukuki metin eklenecektir. */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 text-yellow-800 text-sm">
          <strong>Not:</strong> Bu sayfa şu an için taslak (placeholder) içerik barındırmaktadır. 6698 sayılı Kişisel Verilerin Korunması Kanunu'na uygun olarak bir hukuk danışmanı tarafından hazırlanmış resmi aydınlatma metni eklenmelidir.
        </div>
        
        <p className="mb-4">
          6698 sayılı Kişisel Verilerin Korunması Kanunu ("KVKK") uyarınca, Jasmine Proje Pazarlama ("Şirket") olarak, veri sorumlusu sıfatıyla kişisel verilerinizi hangi amaçlarla işleyeceğimiz, kime ve hangi amaçla aktarabileceğimiz, kişisel veri toplamanın yöntemi ve hukuki sebebi ile haklarınız konusunda sizi bilgilendirmek isteriz.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Kişisel Verilerin İşlenme Amaçları</h2>
        <p className="mb-4">
          Kişisel verileriniz, şirketimiz tarafından sunulan ürün ve hizmetlerden sizleri faydalandırmak için gerekli çalışmaların iş birimlerimiz tarafından yapılması, iş ilişkisi içerisinde olduğumuz kişilerin hukuki ve ticari güvenliğinin temini amaçlarıyla işlenmektedir.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">Veri Sahibinin Hakları</h2>
        <p className="mb-4">
          KVKK'nın 11. maddesi uyarınca veri sahipleri; kişisel verilerinin işlenip işlenmediğini öğrenme, işlenmişse buna ilişkin bilgi talep etme, işlenme amacını öğrenme, eksik/yanlış işlenme varsa düzeltilmesini isteme haklarına sahiptir.
        </p>
      </div>
    </div>
  );
}
