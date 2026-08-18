"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * "Bu listeye bugün N oy verildi" rozeti.
 *
 * Sayı GERÇEK: /api/canli/oy, votes tablosundaki bugünkü kayıtları sayar.
 * Oy yoksa rozet görünmez — sıfırı gizlemek yerine şişirmek yanlış beyan
 * olurdu, gösterecek bir şey yoksa hiç çıkmıyor.
 */

const ANAHTAR = "tn_bugunoy_kapali";

export default function BugunkuOy({
  listeSlug,
  label,
}: {
  /** Oyların sayılacağı liste */
  listeSlug: string;
  /** Özel metin — {n} yerine sayı konur */
  label?: string;
}) {
  const [oy, setOy] = useState<number | null>(null);
  const [kapali, setKapali] = useState(true);
  const [girdi, setGirdi] = useState(false);
  const [arttiIsareti, setArttiIsareti] = useState(false);
  const onceki = useRef<number | null>(null);
  const zaman = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cek = useCallback(async () => {
    try {
      const r = await fetch(`/api/canli/oy?liste=${encodeURIComponent(listeSlug)}`, {
        cache: "no-store",
      });
      if (!r.ok) return;
      const v = (await r.json()) as { oy?: number };
      if (typeof v.oy !== "number") return;
      // Sayı arttıysa kısa bir vurgu — "canlı" hissi gerçek artıştan gelsin
      if (onceki.current !== null && v.oy > onceki.current) {
        setArttiIsareti(true);
        setTimeout(() => setArttiIsareti(false), 1400);
      }
      onceki.current = v.oy;
      setOy(v.oy);
    } catch {
      /* ağ hatası: rozet olduğu gibi kalır */
    }
  }, [listeSlug]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(ANAHTAR) === "1") return;
    setKapali(false);

    void cek();
    const planla = () => {
      const ms = 25_000 + Math.random() * 20_000;
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

  useEffect(() => {
    if (oy !== null && oy > 0) {
      const t = setTimeout(() => setGirdi(true), 40);
      return () => clearTimeout(t);
    }
    setGirdi(false);
  }, [oy]);

  const kapat = () => {
    setKapali(true);
    try {
      sessionStorage.setItem(ANAHTAR, "1");
    } catch {
      /* özel modda yazılamayabilir */
    }
  };

  if (kapali || oy === null || oy < 1) return null;

  const metin = label
    ? label.replace("{n}", String(oy))
    : `Bu listeye bugün ${oy.toLocaleString("tr-TR")} oy verildi`;

  return (
    <div
      className={`canli canli-oy ${girdi ? "canli-girdi" : ""} ${arttiIsareti ? "canli-artti" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="canli-halka canli-halka-oy" aria-hidden="true">
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
