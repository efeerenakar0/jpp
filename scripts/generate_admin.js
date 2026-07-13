import fs from 'fs';
import path from 'path';

const basePath = '/Users/efeerenakar/.gemini/antigravity/scratch/jasmine-proje';

const files = {
  'src/app/admin/layout.tsx': `import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { Building2, LayoutDashboard, FolderKanban, Users, MessageSquare, Calendar, LogOut } from "lucide-react";
import LogoutButton from "@/components/admin/LogoutButton";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerSession(authOptions);

  if (!session || (session.user as any).role !== "ADMIN") {
    redirect("/admin/giris");
  }

  const navItems = [
    { name: "Dashboard", href: "/admin", icon: LayoutDashboard },
    { name: "Projeler", href: "/admin/projeler", icon: FolderKanban },
    { name: "Hizmetler", href: "/admin/hizmetler", icon: Building2 },
    { name: "Talepler", href: "/admin/talepler", icon: MessageSquare },
    { name: "Randevular", href: "/admin/randevular", icon: Calendar },
    { name: "Emlakçılar", href: "/admin/emlakci-basvurulari", icon: Users },
  ];

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-primary-950 text-white flex flex-col hidden md:flex">
        <div className="p-6">
          <h2 className="text-2xl font-serif font-bold text-gold-400">Jasmine CMS</h2>
          <p className="text-xs text-gray-400">Yönetim Paneli</p>
        </div>
        <nav className="flex-1 px-4 space-y-2">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-4 py-3 rounded-md hover:bg-white/10 transition-colors">
              <item.icon className="w-5 h-5" />
              {item.name}
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10">
          <LogoutButton />
        </div>
      </aside>
      
      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {children}
      </main>
    </div>
  );
}
`,
  'src/app/admin/giris/page.tsx': `"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast, { Toaster } from 'react-hot-toast';

export default function AdminLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    if (res?.error) {
      toast.error("Giriş başarısız. Lütfen bilgilerinizi kontrol edin.");
    } else {
      toast.success("Giriş başarılı!");
      router.push("/admin");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <Toaster />
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-center mb-6">Yönetici Girişi</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Şifre</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1 w-full p-2 border rounded-md" required />
          </div>
          <button type="submit" className="w-full bg-primary-700 text-white p-2 rounded-md hover:bg-primary-800 transition">Giriş Yap</button>
        </form>
      </div>
    </div>
  );
}
`,
  'src/components/admin/LogoutButton.tsx': `"use client";
import { signOut } from "next-auth/react";
import { LogOut } from "lucide-react";

export default function LogoutButton() {
  return (
    <button onClick={() => signOut({ callbackUrl: '/' })} className="flex items-center gap-3 px-4 py-3 w-full rounded-md hover:bg-white/10 transition-colors text-left">
      <LogOut className="w-5 h-5 text-red-400" />
      <span className="text-red-400">Çıkış Yap</span>
    </button>
  );
}
`,
  'src/app/admin/page.tsx': `export default function AdminDashboard() {
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
`,
  'src/app/admin/projeler/page.tsx': `import { PrismaClient } from "@prisma/client";
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
                  <Link href={\`/admin/projeler/\${p.id}\`} className="text-primary-600 hover:underline">Düzenle</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
`
};

for (const [relPath, content] of Object.entries(files)) {
  const fullPath = path.join(basePath, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  fs.writeFileSync(fullPath, content);
  console.log('Created:', relPath);
}
