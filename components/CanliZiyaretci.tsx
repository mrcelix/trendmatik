"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";

/**
 * Canlı ziyaretçi rozeti.
 *
 * Sayı GERÇEK ölçümdür: /api/canli, events tablosundaki son 5 dakikalık
 * benzersiz görüntüleyicileri sayar. Veri yoksa ya da tek kişi varsa
 * (yani yalnızca sen) rozet kendini gizler — sayı uydurulmaz, çünkü
 * ziyaretçiye ölçüm olarak sunuluyor.
 *
 * Kapatma sessionStorage'da tutulur: sekme boyunca bir daha çıkmaz.
 */

const ANAHTAR = "tn_canli_kapali";
/** Bu sayının altında rozet anlamlı değil (yalnızca ziyaretçinin kendisi) */
const EN_AZ = 2;

export default function CanliZiyaretci({
  pageKey,
  label,
}: {
  /** Sayının ölçüleceği yol; verilmezse mevcut sayfa kullanılır */
  pageKey?: string;
  /** Özel metin — {n} yerine sayı konur */
  label?: string;
}) {
  const yolAktif = usePathname();
  const yol = pageKey ?? yolAktif ?? "/";

  const [sayi, setSayi] = useState<number | null>(null);
  const [kapali, setKapali] = useState(true); // ilk okumaya kadar gizli
  const [girdi, setGirdi] = useState(false);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cek = useCallback(async () => {
    try {
      const r = await fetch(`/api/canli?yol=${encodeURIComponent(yol)}`, { cache: "no-store" });
      if (!r.ok) return;
      const v = (await r.json()) as { sayi?: number };
      setSayi(typeof v.sayi === "number" ? v.sayi : null);
    } catch {
      /* ağ hatası: rozet olduğu gibi kalır */
    }
  }, [yol]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(ANAHTAR) === "1") return;
    setKapali(false);

    void cek();
    // 20–40 sn arası rastgele aralık: tüm sekmeler aynı anda istek atmasın
    const planla = () => {
      const ms = 20_000 + Math.random() * 20_000;
      zaman.current = setTimeout(async () => {
        await cek();
        planla();
      }, ms);
    };
    planla();

    return () => {
      if (zaman.current) clearTimeout(zaman.current);
    };
  }, [cek]);

  // Görünür olduğunda içeri kayma animasyonu
  useEffect(() => {
    if (sayi !== null && sayi >= EN_AZ) {
      const t = setTimeout(() => setGirdi(true), 40);
      return () => clearTimeout(t);
    }
    setGirdi(false);
  }, [sayi]);

  const kapat = () => {
    setKapali(true);
    try {
      sessionStorage.setItem(ANAHTAR, "1");
    } catch {
      /* özel modda yazılamayabilir */
    }
  };

  if (kapali || sayi === null || sayi < EN_AZ) return null;

  const metin = label ? label.replace("{n}", String(sayi)) : `Şu anda ${sayi} kişi bu sayfayı görüntülüyor`;

  return (
    <div className={`canli ${girdi ? "canli-girdi" : ""}`} role="status" aria-live="polite">
      <span className="canli-halka" aria-hidden="true">
        <span className="canli-nokta" />
        <span className="canli-ping" />
      </span>

      <span className="canli-metin">{metin}</span>

      <button className="canli-kapat" onClick={kapat} aria-label="Rozeti kapat" type="button">
        ✕
      </button>
    </div>
  );
}
