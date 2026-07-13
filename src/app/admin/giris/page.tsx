"use client";
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
