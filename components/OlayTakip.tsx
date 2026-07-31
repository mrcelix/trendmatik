"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Sayfa görüntülemelerini ve iç bağlantı tıklamalarını kaydeder.
 * Yönetim sayfaları ve API yolları sayılmaz. Kişisel veri toplanmaz;
 * yalnızca yol, hedef ve mevcut ziyaretçi çerezi gönderilir.
 */
export default function OlayTakip() {
  const yol = usePathname();

  useEffect(() => {
    if (!yol || yol.startsWith("/admin") || yol.startsWith("/api")) return;

    const gonder = (tur: string, hedef = "") => {
      const govde = JSON.stringify({ tur, yol, hedef });
      // sendBeacon sayfa kapanırken bile teslim eder
      if (navigator.sendBeacon) {
        navigator.sendBeacon("/api/olay", new Blob([govde], { type: "application/json" }));
      } else {
        fetch("/api/olay", { method: "POST", headers: { "Content-Type": "application/json" }, body: govde }).catch(
          () => {}
        );
      }
    };

    gonder("goruntuleme");

    const tiklama = (e: MouseEvent) => {
      const bag = (e.target as HTMLElement)?.closest?.("a");
      if (!bag) return;
      const href = bag.getAttribute("href") ?? "";
      if (!href || href.startsWith("#")) return;
      gonder("tiklama", href.slice(0, 200));
    };

    document.addEventListener("click", tiklama);
    return () => document.removeEventListener("click", tiklama);
  }, [yol]);

  return null;
}
