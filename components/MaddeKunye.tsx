"use client";

import { useEffect, useRef, useState } from "react";
import { kunyeSatirlari, type Kunye } from "@/lib/madde-kunye";

/**
 * Madde künyesi — her alan kendi simgesiyle ayrı ayrı gösterilir.
 *
 * Bağlantısı olan alanlar (harita, telefon, site) doğrudan tıklanır.
 * Bağlantısı olmayanlar (adres, fiyat) tıklanınca değerini yanında açar;
 * yalnızca :title'a bırakmak dokunmatik cihazlarda erişilemez olurdu.
 * Gösterilecek alanı olmayan maddede hiçbir şey çizilmez.
 */
export default function MaddeKunye({
  ad,
  sehir,
  kategoriSlug,
  kunye,
}: {
  ad: string;
  sehir?: string | null;
  kategoriSlug?: string;
  kunye: Kunye;
}) {
  const [acikAlan, setAcikAlan] = useState<string | null>(null);
  const sarmal = useRef<HTMLSpanElement>(null);

  const satirlar = kunyeSatirlari(kunye, { ad, sehir, kategoriSlug });

  useEffect(() => {
    if (!acikAlan) return;
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") setAcikAlan(null); };
    const tikla = (e: MouseEvent) => {
      if (sarmal.current && !sarmal.current.contains(e.target as Node)) setAcikAlan(null);
    };
    document.addEventListener("keydown", tus);
    document.addEventListener("mousedown", tikla);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("mousedown", tikla);
    };
  }, [acikAlan]);

  if (!satirlar.length) return null;

  return (
    <span className="kunye" ref={sarmal}>
      {satirlar.map((s) => {
        const ipucu = `${s.etiket}: ${s.deger}`;

        if (s.adres) {
          return (
            <a
              key={s.alan}
              className={`kunye-ikon kunye-${s.alan}`}
              href={s.adres}
              title={ipucu}
              aria-label={`${ad} — ${ipucu}`}
              target={s.adres.startsWith("tel:") ? undefined : "_blank"}
              rel="noopener noreferrer nofollow"
            >
              <span aria-hidden="true">{s.simge}</span>
            </a>
          );
        }

        // Bağlantısız alanlar: tıklayınca değeri yanında açılır
        return (
          <span key={s.alan} className="kunye-sarmal">
            <button
              className={`kunye-ikon kunye-${s.alan} ${acikAlan === s.alan ? "acik" : ""}`}
              title={ipucu}
              aria-label={`${ad} — ${ipucu}`}
              aria-expanded={acikAlan === s.alan}
              onClick={() => setAcikAlan((a) => (a === s.alan ? null : s.alan))}
            >
              <span aria-hidden="true">{s.simge}</span>
            </button>
            {acikAlan === s.alan && (
              <span className="kunye-deger" role="tooltip">
                <b>{s.etiket}</b>
                <span>{s.deger}</span>
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}
