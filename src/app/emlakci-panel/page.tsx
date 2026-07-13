import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import LogoutButton from "@/components/admin/LogoutButton";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export default async function AgentPanel() {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "AGENT") {
    redirect("/admin/giris"); // Veya emlakçı özel girişine yönlendir
  }

  const projects = await prisma.project.findMany({ where: { published: true } });

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-serif font-bold text-gray-900">Emlakçı Portalı</h1>
          <div className="flex items-center gap-4">
            <span className="font-medium text-gray-700">Hoş geldiniz, {session.user?.name}</span>
            <div className="bg-white p-1 rounded-md shadow-sm border border-gray-200">
              <LogoutButton />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium text-sm">Aktif Projeler</h3>
            <p className="text-3xl font-bold mt-2 text-primary-700">{projects.length}</p>
          </div>
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium text-sm">Portföyünüzdeki Müşteriler (Lead)</h3>
            <p className="text-3xl font-bold mt-2 text-primary-700">0</p>
          </div>
          <div className="bg-white p-6 rounded-md shadow-sm border border-gray-200">
            <h3 className="text-gray-500 font-medium text-sm">Onaylanan Satışlar</h3>
            <p className="text-3xl font-bold mt-2 text-primary-700">0</p>
          </div>
        </div>

        <div className="bg-white rounded-md shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 flex justify-between items-center">
            <h2 className="text-xl font-bold text-gray-900">Proje Dokümanları & Fiyat Listeleri</h2>
          </div>
          <table className="w-full text-left">
            <thead className="bg-gray-50">
              <tr>
                <th className="p-4 text-sm font-medium text-gray-500">Proje Adı</th>
                <th className="p-4 text-sm font-medium text-gray-500">Lokasyon</th>
                <th className="p-4 text-sm font-medium text-gray-500">İşlemler</th>
              </tr>
            </thead>
            <tbody>
              {projects.map((p) => (
                <tr key={p.id} className="border-t border-gray-100">
                  <td className="p-4 font-medium">{p.name}</td>
                  <td className="p-4">{p.location}</td>
                  <td className="p-4 flex gap-3">
                    <button className="text-primary-600 text-sm hover:underline">Fiyat Listesi İndir</button>
                    <button className="text-primary-600 text-sm hover:underline">Broşür İndir</button>
                    <button className="text-primary-600 text-sm hover:underline">Görselleri İndir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
