"use client";

import Link from "next/link";
import { useEffect } from "react";

import { MarketingSystemState } from "@/marketing/components/system/marketing-system-state";

export default function MarketingError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <MarketingSystemState
      actions={
        <>
          <button onClick={() => unstable_retry()} type="button">
            Akışı tekrar dene
          </button>
          <Link href="/tr">Ana sayfaya dön</Link>
        </>
      }
      code="500"
      description="Beklenmeyen bir sistem hatası oluştu. Akışı yeniden deneyebilir veya ana operasyon sayfasına güvenle dönebilirsiniz."
      eyebrow="Sistem kesintisi"
      title="Aksiyon tamamlanamadı."
    />
  );
}
