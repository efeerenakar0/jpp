import { PrismaClient } from "@prisma/client";
import Link from "next/link";

const prisma = new PrismaClient();

export default async function AdminProjects() {
  const projects = await prisma.project.findMany();

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Projeler</h1>
        <button className="bg-primary-700 text-white px-4 py-2 rounded-md hover:bg-primary-800">
          + Yeni Proje
        </button>
      </div>
      
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="p-4 text-sm font-medium text-gray-500">Proje Adı</th>
              <th className="p-4 text-sm font-medium text-gray-500">Lokasyon</th>
              <th className="p-4 text-sm font-medium text-gray-500">Durum</th>
              <th className="p-4 text-sm font-medium text-gray-500">İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="p-4 font-medium">{p.name}</td>
                <td className="p-4">{p.location}</td>
                <td className="p-4">{p.status}</td>
                <td className="p-4">
                  <Link href={`/admin/projeler/${p.id}`} className="text-primary-600 hover:underline">Düzenle</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
