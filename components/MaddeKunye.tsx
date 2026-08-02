"use client";

import { useEffect, useRef, useState } from "react";
import { kunyeSatirlari, type Kunye } from "@/lib/madde-kunye";

/**
 * Madde künyesi balonu.
 *
 * Masaüstünde üzerine gelince, dokunmatikte düğmeye basınca açılır:
 * yalnızca :hover'a bağlamak dokunmatik cihazlarda erişilemez yapardı.
 * Künyede gösterilecek hiçbir alan yoksa düğme de çizilmez.
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
  const [acik, setAcik] = useState(false);
  const sarmal = useRef<HTMLSpanElement>(null);
  const kapatmaZamani = useRef<ReturnType<typeof setTimeout> | null>(null);

  const satirlar = kunyeSatirlari(kunye, { ad, sehir, kategoriSlug });

  useEffect(() => {
    if (!acik) return;
    const tus = (e: KeyboardEvent) => { if (e.key === "Escape") setAcik(false); };
    const tikla = (e: MouseEvent) => {
      if (sarmal.current && !sarmal.current.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener("keydown", tus);
    document.addEventListener("mousedown", tikla);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("mousedown", tikla);
    };
  }, [acik]);

  if (!satirlar.length) return null;

  // Fare balonun üstüne geçerken kapanmasın diye kısa gecikme
  const gecikmeliKapat = () => {
    kapatmaZamani.current = setTimeout(() => setAcik(false), 160);
  };
  const kapatmayiIptal = () => {
    if (kapatmaZamani.current) clearTimeout(kapatmaZamani.current);
  };

  return (
    <span
      className="kunye"
      ref={sarmal}
      onMouseEnter={() => { kapatmayiIptal(); setAcik(true); }}
      onMouseLeave={gecikmeliKapat}
    >
      <button
        className={`kunye-dugme ${acik ? "acik" : ""}`}
        onClick={() => setAcik((a) => !a)}
        onFocus={() => setAcik(true)}
        aria-expanded={acik}
        aria-label={`${ad} hakkında bilgi`}
      >
        ⓘ
      </button>

      {acik && (
        <span className="kunye-balon" role="tooltip">
          <span className="kunye-ad">{ad}</span>
          {satirlar.map((s) => {
            const icerik = (
              <>
                <span className="kunye-simge" aria-hidden="true">{s.simge}</span>
                <span className="kunye-metin">
                  <b>{s.etiket}</b>
                  <span>{s.deger}</span>
                </span>
              </>
            );
            return s.adres ? (
              <a
                key={s.alan}
                className="kunye-satir"
                href={s.adres}
                target={s.adres.startsWith("tel:") ? undefined : "_blank"}
                rel="noopener noreferrer nofollow"
              >
                {icerik}
              </a>
            ) : (
              <span key={s.alan} className="kunye-satir">{icerik}</span>
            );
          })}
        </span>
      )}
    </span>
  );
}
