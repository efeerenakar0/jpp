export default function AdminDashboard() {
  return (
    <div>
      <h1 className="text-3xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Toplam Proje</h3>
          <p className="text-3xl font-bold mt-2">15</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Yeni Talepler</h3>
          <p className="text-3xl font-bold mt-2">42</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Aktif Randevular</h3>
          <p className="text-3xl font-bold mt-2">8</p>
        </div>
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-sm font-medium text-gray-500">Bülten Aboneleri</h3>
          <p className="text-3xl font-bold mt-2">1,240</p>
        </div>
      </div>
      
      <h2 className="text-xl font-bold mb-4">Son Gelen Talepler</h2>
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-sm font-medium text-gray-500">Ad Soyad</th>
              <th className="p-4 text-sm font-medium text-gray-500">Email</th>
              <th className="p-4 text-sm font-medium text-gray-500">Durum</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-gray-100">
              <td className="p-4">Ahmet Yılmaz</td>
              <td className="p-4">ahmet@example.com</td>
              <td className="p-4"><span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs">Yeni</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
