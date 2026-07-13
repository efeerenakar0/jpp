import { getServerSession } from "next-auth/next";
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
