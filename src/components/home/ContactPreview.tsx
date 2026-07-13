"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useState } from "react";
import { motion } from "framer-motion";
import { siteContent } from "@/data/site-content";
import { MapPin, Phone, Mail } from "lucide-react";

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
    <section className="py-24 bg-white">
      <div className="container mx-auto px-4 md:px-6">
        <div className="flex flex-col lg:flex-row gap-16">
          {/* Info */}
          <div className="flex-1">
            <h2 className="text-3xl md:text-4xl font-serif font-bold text-gray-900 mb-6">
              Bizimle İletişime Geçin
            </h2>
            <p className="text-gray-600 mb-10 leading-relaxed">
              Projelerimiz hakkında detaylı bilgi almak, yatırım danışmanlığı talep etmek veya iş ortaklığı süreçlerini görüşmek için formu doldurabilirsiniz. Uzman ekibimiz en kısa sürede size dönüş yapacaktır.
            </p>

            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-50 rounded-sm flex items-center justify-center shrink-0">
                  <MapPin className="w-6 h-6 text-primary-700" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Merkez Ofis</h4>
                  <p className="text-gray-600 text-sm mt-1">{siteContent.contact.address}</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-50 rounded-sm flex items-center justify-center shrink-0">
                  <Phone className="w-6 h-6 text-primary-700" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">Telefon</h4>
                  <a href={`tel:${siteContent.contact.phone.replace(/\s+/g, "")}`} className="text-gray-600 text-sm mt-1 hover:text-primary-700">
                    {siteContent.contact.phone}
                  </a>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-primary-50 rounded-sm flex items-center justify-center shrink-0">
                  <Mail className="w-6 h-6 text-primary-700" />
                </div>
                <div>
                  <h4 className="font-bold text-gray-900">E-Posta</h4>
                  <a href={`mailto:${siteContent.contact.email}`} className="text-gray-600 text-sm mt-1 hover:text-primary-700">
                    {siteContent.contact.email}
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="flex-1">
            <div className="bg-white border border-gray-100 p-8 rounded-sm shadow-xl">
              <h3 className="text-2xl font-serif font-bold text-gray-900 mb-6">Mesaj Gönderin</h3>
              
              {submitStatus === "success" && (
                <div className="mb-6 p-4 bg-green-50 text-green-800 border border-green-200 rounded-sm text-sm">
                  Mesajınız başarıyla alınmıştır. En kısa sürede size dönüş yapacağız.
                </div>
              )}
              {submitStatus === "error" && (
                <div className="mb-6 p-4 bg-red-50 text-red-800 border border-red-200 rounded-sm text-sm">
                  Bir hata oluştu. Lütfen daha sonra tekrar deneyiniz.
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad</label>
                  <input
                    id="name"
                    {...register("name")}
                    className={`w-full px-4 py-3 rounded-sm border ${errors.name ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent transition-all`}
                    placeholder="Adınız Soyadınız"
                  />
                  {errors.name && <p className="mt-1 text-xs text-red-500">{errors.name.message}</p>}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">E-Posta</label>
                    <input
                      id="email"
                      type="email"
                      {...register("email")}
                      className={`w-full px-4 py-3 rounded-sm border ${errors.email ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all`}
                      placeholder="ornek@email.com"
                    />
                    {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                  </div>
                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">Telefon</label>
                    <input
                      id="phone"
                      type="tel"
                      {...register("phone")}
                      className={`w-full px-4 py-3 rounded-sm border ${errors.phone ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all`}
                      placeholder="+90 5XX XXX XX XX"
                    />
                    {errors.phone && <p className="mt-1 text-xs text-red-500">{errors.phone.message}</p>}
                  </div>
                </div>

                <div>
                  <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-1">Mesajınız</label>
                  <textarea
                    id="message"
                    rows={4}
                    {...register("message")}
                    className={`w-full px-4 py-3 rounded-sm border ${errors.message ? 'border-red-500' : 'border-gray-300'} focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all`}
                    placeholder="Size nasıl yardımcı olabiliriz?"
                  ></textarea>
                  {errors.message && <p className="mt-1 text-xs text-red-500">{errors.message.message}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-primary-700 hover:bg-primary-800 text-white font-medium py-3.5 rounded-sm transition-colors disabled:opacity-70 disabled:cursor-not-allowed"
                >
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
