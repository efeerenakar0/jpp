import Link from "next/link";

import { MarketingSystemState } from "@/marketing/components/system/marketing-system-state";

export default function MarketingNotFound() {
  return (
    <MarketingSystemState
      actions={
        <>
          <Link href="/tr">Ana sayfaya dön</Link>
          <Link href="/tr/realestate">Emlak ürününü keşfet</Link>
        </>
      }
      code="404"
      description="İstediğiniz rota artık aktif değil veya başka bir operasyon alanına taşındı. Ana sisteme dönerek doğru akıştan devam edebilirsiniz."
      eyebrow="Rota bulunamadı"
      title="Bu sinyal sisteme ulaşmadı."
    />
  );
}
