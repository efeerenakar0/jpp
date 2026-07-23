export default function PrivacyPolicy() {
  return (
    <div className="container mx-auto px-4 py-20 max-w-4xl">
      <h1 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-8">Gizlilik Politikası</h1>
      <div className="prose prose-primary max-w-none text-gray-600">
        <p className="mb-4">Son güncellenme tarihi: {new Date().toLocaleDateString('tr-TR')}</p>
        {/* TODO: Gerçek hukuki metin bir danışman/avukat tarafından buraya eklenecektir. */}
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-8 text-yellow-800 text-sm">
          <strong>Not:</strong> Bu sayfa şu an için taslak (placeholder) içerik barındırmaktadır. Gerçek yayın öncesi bir hukuk danışmanı tarafından hazırlanmış resmi gizlilik politikası metni eklenmelidir.
        </div>
        
        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">1. Giriş</h2>
        <p className="mb-4">
          Jasmine Proje Pazarlama ("Şirket", "Biz", "Bize" veya "Bizi") olarak gizliliğinize saygı duyuyor ve kişisel verilerinizi korumaya önem veriyoruz. Bu Gizlilik Politikası, web sitemizi ziyaret ettiğinizde kişisel verilerinizi nasıl topladığımızı, kullandığımızı ve koruduğumuzu açıklamaktadır.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">2. Toplanan Veriler</h2>
        <p className="mb-4">
          İletişim formları, bülten kayıtları veya B2B portalımıza üye olurken sağladığınız ad, soyad, e-posta, telefon numarası gibi kişisel verileri toplayabiliriz.
        </p>

        <h2 className="text-xl font-bold text-gray-900 mt-8 mb-4">3. Verilerin Kullanımı</h2>
        <p className="mb-4">
          Toplanan veriler size daha iyi hizmet sunmak, taleplerinize yanıt vermek, yasal yükümlülükleri yerine getirmek ve pazarlama faaliyetlerini yürütmek amacıyla kullanılabilir.
        </p>
      </div>
    </div>
  );
}
