"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

export default function CookieBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const consent = localStorage.getItem("cookieConsent");
    if (!consent) {
      // Biraz gecikmeli göster
      const timer = setTimeout(() => setShow(true), 1500);
      return () => clearTimeout(timer);
    }
  }, []);

  const accept = () => {
    localStorage.setItem("cookieConsent", "accepted");
    setShow(false);
  };

  const decline = () => {
    localStorage.setItem("cookieConsent", "declined");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-gray-200 shadow-2xl p-4 md:p-6"
        >
          <div className="container mx-auto max-w-6xl flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex-1 text-sm text-gray-600">
              <p>
                Size daha iyi hizmet sunabilmek için web sitemizde çerezler kullanılmaktadır. 
                Siteyi kullanmaya devam ederek çerez kullanımımızı ve{" "}
                <a href="/cerez-politikasi" className="text-primary-700 underline underline-offset-2">Çerez Politikamızı</a>{" "}
                kabul etmiş sayılırsınız.
              </p>
            </div>
            <div className="flex items-center gap-3 w-full md:w-auto shrink-0">
              <button
                onClick={decline}
                className="flex-1 md:flex-none px-6 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-sm transition-colors"
              >
                Reddet
              </button>
              <button
                onClick={accept}
                className="flex-1 md:flex-none px-6 py-2.5 text-sm font-medium text-white bg-primary-700 hover:bg-primary-800 rounded-sm transition-colors"
              >
                Kabul Et
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
