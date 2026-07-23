"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { siteContent } from "@/data/site-content";
import { MapPin, Phone, Mail, Send, Sparkles } from "lucide-react";

const formSchema = z.object({
  name: z.string().min(2, "Ad soyad en az 2 karakter olmalıdır"),
  email: z.string().email("Geçerli bir e-posta adresi giriniz"),
  phone: z.string().min(10, "Geçerli bir telefon numarası giriniz"),
  message: z.string().min(10, "Mesajınız en az 10 karakter olmalıdır"),
});

type FormData = z.infer<typeof formSchema>;

export default function ContactPreview() {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
  });

  const onSubmit = async (data: FormData) => {
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        setSubmitStatus("success");
        reset();
      } else {
        setSubmitStatus("error");
      }
    } catch (error) {
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
      setTimeout(() => setSubmitStatus("idle"), 5000);
    }
  };

  return (
    <section className="py-24 bg-[#090d16] text-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row gap-16 items-start">
          {/* Info */}
          <div className="flex-1 space-y-6">
            <span className="text-xs font-black text-cyan-400 uppercase tracking-widest block">
              7/24 Kesintisiz İletişim
            </span>
            
            <h2 className="text-3xl md:text-5xl font-serif font-black text-white leading-tight">
              Bizimle İletişime Geçin
            </h2>

            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              Projelerimiz hakkında detaylı bilgi almak, yatırım danışmanlığı talep etmek veya iş ortaklığı süreçlerini görüşmek için formu doldurabilirsiniz. Uzman ekibimiz saniyeler içinde size dönüş yapacaktır.
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-xl">
                <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">Merkez Ofis</h4>
                  <p className="text-slate-400 text-xs mt-0.5 font-medium">{siteContent.contact.address}</p>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-xl">
                <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center shrink-0">
                  <Phone className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">Telefon</h4>
                  <a href={`tel:${siteContent.contact.phone.replace(/\s+/g, "")}`} className="text-slate-400 text-xs mt-0.5 hover:text-cyan-400 font-medium transition-colors">
                    {siteContent.contact.phone}
                  </a>
                </div>
              </div>

              <div className="flex items-center gap-4 bg-slate-900/60 border border-slate-800/80 p-4 rounded-2xl backdrop-blur-xl">
                <div className="w-10 h-10 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs">E-Posta</h4>
                  <a href={`mailto:${siteContent.contact.email}`} className="text-slate-400 text-xs mt-0.5 hover:text-cyan-400 font-medium transition-colors">
                    {siteContent.contact.email}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1 w-full">
            <div className="bg-slate-900/80 border border-slate-800 p-8 rounded-3xl shadow-2xl backdrop-blur-2xl">
              <h3 className="text-xl font-serif font-black text-white mb-6 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" /> Mesaj Gönderin
              </h3>
              
              {submitStatus === "success" && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-2xl text-xs font-bold">
                  Mesajınız başarıyla alınmıştır. En kısa sürede size dönüş yapacağız.
                </div>
              )}
              {submitStatus === "error" && (
                <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-2xl text-xs font-bold">
                  Bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-xs font-bold text-slate-400 mb-1">Ad Soyad</label>
                  <input
                    id="name"
                    {...register("name")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 font-medium"
                    placeholder="Adınız Soyadınız"
                  />
                  {errors.name && <p className="mt-1 text-[10px] text-rose-400 font-bold">{errors.name.message}</p>}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-xs font-bold text-slate-400 mb-1">E-Posta</label>
                    <input
                      id="email"
                      type="email"
                      {...register("email")}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 font-medium"
                      placeholder="ornek@email.com"
                    />
                    {errors.email && <p className="mt-1 text-[10px] text-rose-400 font-bold">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-xs font-bold text-slate-400 mb-1">Telefon</label>
                    <input
                      id="phone"
                      type="tel"
                      {...register("phone")}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 font-medium"
                      placeholder="+90 5XX XXX XX XX"
                    />
                    {errors.phone && <p className="mt-1 text-[10px] text-rose-400 font-bold">{errors.phone.message}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-xs font-bold text-slate-400 mb-1">Mesajınız</label>
                  <textarea
                    id="message"
                    rows={4}
                    {...register("message")}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-4 py-3 text-xs text-white outline-none focus:border-cyan-400 font-medium"
                    placeholder="Size nasıl yardımcı olabiliriz?"
                  ></textarea>
                  {errors.message && <p className="mt-1 text-[10px] text-rose-400 font-bold">{errors.message.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-gradient-to-r from-cyan-400 via-teal-400 to-emerald-400 hover:from-cyan-300 hover:to-emerald-300 text-slate-950 font-black py-3.5 rounded-2xl transition-all shadow-lg shadow-cyan-500/20 text-xs uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Send className="w-4 h-4" />
                  {isSubmitting ? "Gönderiliyor..." : "Mesajı Gönder"}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
