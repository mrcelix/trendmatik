"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { HizliKart } from "@/lib/db";

/**
 * Kart kart hızlı oylama.
 * Tek dokunuşla 👍/👎, istemezse geç. Oy mevcut /api/vote ucuna gider,
 * yani günlük sınır ve manipülasyon savunmaları aynen geçerli.
 * Klavye: ← beğenme, → beğen, boşluk geç.
 */
export default function HizliOyla({ kartlar }: { kartlar: HizliKart[] }) {
  const [i, setI] = useState(0);
  const [begeni, setBegeni] = useState(0);
  const [seri, setSeri] = useState(0);
  const [uyari, setUyari] = useState<string | null>(null);
  const [gonderiliyor, setGonderiliyor] = useState(false);
  const [cikis, setCikis] = useState<"sol" | "sag" | "yukari" | null>(null);

  const kart = kartlar[i];
  const bitti = i >= kartlar.length;

  const ilerle = useCallback((yon: "sol" | "sag" | "yukari") => {
    setCikis(yon);
    // Kart animasyonu bitince sıradakine geç
    setTimeout(() => {
      setCikis(null);
      setI((n) => n + 1);
    }, 180);
  }, []);

  const oyVer = useCallback(
    async (deger: 1 | -1) => {
      if (!kart || gonderiliyor) return;
      setGonderiliyor(true);
      setUyari(null);
      try {
        const res = await fetch("/api/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ itemId: kart.id, value: deger }),
        });
        const veri = await res.json();
        if (!res.ok || veri.ok === false) {
          // Günlük sınır gibi durumlarda akış durur, sebep gösterilir
          setUyari(veri.error ?? "Oy kaydedilemedi.");
          setGonderiliyor(false);
          return;
        }
        if (deger === 1) setBegeni((n) => n + 1);
        setSeri((n) => n + 1);
        ilerle(deger === 1 ? "sag" : "sol");
      } catch {
        setUyari("Bağlantı hatası — oy kaydedilemedi.");
      } finally {
        setGonderiliyor(false);
      }
    },
    [kart, gonderiliyor, ilerle]
  );

  const gec = useCallback(() => {
    setSeri(0);
    ilerle("yukari");
  }, [ilerle]);

  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "ArrowRight") { e.preventDefault(); void oyVer(1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); void oyVer(-1); }
      else if (e.key === " ") { e.preventDefault(); gec(); }
    };
    window.addEventListener("keydown", tus);
    return () => window.removeEventListener("keydown", tus);
  }, [oyVer, gec]);

  if (bitti) {
    return (
      <div className="hizli-bitti">
        <div className="hizli-bitti-ikon" aria-hidden="true">🎉</div>
        <h2>Tur tamamlandı</h2>
        <p>
          {kartlar.length} kart gördün, <b>{begeni}</b> tanesini beğendin.
          Verdiğin oylar sıralamalara hemen yansıdı.
        </p>
        <div className="hizli-bitti-dugmeler">
          <Link href="/hizli" className="btn btn-primary btn-lg">Yeni tur</Link>
          <Link href="/" className="btn btn-lg">Sıralamalara bak</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="hizli">
      <div className="hizli-ust">
        <div className="hizli-ilerleme" aria-hidden="true">
          <span style={{ width: `${(i / kartlar.length) * 100}%` }} />
        </div>
        <div className="hizli-sayac">
          <span className="font-num">{i + 1}</span> / {kartlar.length}
          {seri >= 3 && <span className="hizli-seri">🔥 {seri} seri</span>}
        </div>
      </div>

      <div className={`hizli-kart ${cikis ? `cikis-${cikis}` : ""}`}>
        <Link href={`/liste/${kart.topicSlug}`} className="hizli-liste">
          {kart.categoryEmoji} {kart.topicTitle}
          {kart.city && <span className="city-tag">{kart.city}</span>}
        </Link>

        <div className="hizli-ad">{kart.name}</div>

        <div className="hizli-oy-bilgi">
          {kart.oy === 0 ? "Henüz hiç oy almamış — ilk oy senin olsun" : `${kart.oy} oy almış`}
        </div>
      </div>

      {uyari && <p className="alert-err hizli-uyari">{uyari}</p>}

      <div className="hizli-dugmeler">
        <button
          className="hizli-dugme hizli-hayir"
          onClick={() => void oyVer(-1)}
          disabled={gonderiliyor}
          aria-label="Beğenmedim"
        >
          👎
        </button>
        <button className="hizli-dugme hizli-gec" onClick={gec} aria-label="Geç">
          ⏭
        </button>
        <button
          className="hizli-dugme hizli-evet"
          onClick={() => void oyVer(1)}
          disabled={gonderiliyor}
          aria-label="Beğendim"
        >
          👍
        </button>
      </div>

      <p className="hizli-ipucu">
        Klavye: <kbd>←</kbd> beğenmedim · <kbd>→</kbd> beğendim · <kbd>boşluk</kbd> geç
      </p>
    </div>
  );
}
