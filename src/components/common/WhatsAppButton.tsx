"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";
import { siteContent } from "@/data/site-content";
import { motion, AnimatePresence } from "framer-motion";

export default function WhatsAppButton() {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // Biraz gecikmeli gelsin
    const timer = setTimeout(() => {
      setIsVisible(true);
    }, 3000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.a
          initial={{ opacity: 0, scale: 0.8, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.8, y: 20 }}
          href={`https://wa.me/${siteContent.contact.whatsapp}`}
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-6 right-6 z-50 bg-[#25D366] text-white p-4 rounded-full shadow-lg hover:bg-[#20bd5a] hover:-translate-y-1 transition-all duration-300 flex items-center justify-center group"
          aria-label="WhatsApp üzerinden iletişime geçin"
        >
          <MessageCircle className="w-6 h-6" />
          {/* Tooltip */}
          <span className="absolute right-full mr-4 bg-white text-gray-800 text-sm font-medium px-3 py-1.5 rounded-lg shadow-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            Bize Ulaşın
          </span>
          {/* Ping animation effect */}
          <span className="absolute inset-0 rounded-full bg-[#25D366] animate-ping opacity-20"></span>
        </motion.a>
      )}
    </AnimatePresence>
  );
}
