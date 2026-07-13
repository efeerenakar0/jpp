"use client";
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
