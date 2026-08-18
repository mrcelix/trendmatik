"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { SiralamaYarisi as Veri } from "@/lib/db";

/**
 * Sıralama yarışı: listenin son 30 gününü kare kare oynatır.
 *
 * Çubuklar mutlak konumlandırılıp `transform: translateY` ile taşınıyor —
 * DOM sırası değişmediği için tarayıcı yer değiştirmeyi kesintisiz
 * canlandırıyor (liste yeniden sıralansa her karede sıçrardı).
 */

const HIZ_MS = 900;
const SATIR_Y = 42;

export default function SiralamaYarisi({ veri, baslik }: { veri: Veri; baslik: string }) {
  const [kare, setKare] = useState(0);
  const [oynuyor, setOynuyor] = useState(false);
  const zaman = useRef<ReturnType<typeof setInterval> | null>(null);

  const sonKare = veri.kareler.length - 1;

  // Renk maddeye sabitlenir: aynı madde her karede aynı renkte kalsın
  const renkler = useMemo(() => {
    const palet = [
      "#3a45e0", "#0f9d8f", "#e0494e", "#efa013", "#7c3aed",
      "#0ea5e9", "#15a24a", "#db2777", "#f97316", "#475569",
    ];
    const m = new Map<number, string>();
    veri.maddeler.forEach((x, i) => m.set(x.id, palet[i % palet.length]));
    return m;
  }, [veri.maddeler]);

  const durdur = useCallback(() => {
    if (zaman.current) clearInterval(zaman.current);
    zaman.current = null;
    setOynuyor(false);
  }, []);

  const oynat = useCallback(() => {
    if (oynuyor) return durdur();
    // Sondaysa baştan başlar
    setKare((k) => (k >= sonKare ? 0 : k));
    setOynuyor(true);
  }, [oynuyor, durdur, sonKare]);

  useEffect(() => {
    if (!oynuyor) return;
    zaman.current = setInterval(() => {
      setKare((k) => {
        if (k >= sonKare) {
          if (zaman.current) clearInterval(zaman.current);
          zaman.current = null;
          setOynuyor(false);
          return k;
        }
        return k + 1;
      });
    }, HIZ_MS);
    return () => {
      if (zaman.current) clearInterval(zaman.current);
      zaman.current = null;
    };
  }, [oynuyor, sonKare]);

  if (veri.kareler.length < 2) return null;

  const suan = veri.kareler[Math.min(kare, sonKare)];
  const konum = new Map(suan.siralar.map((s) => [s.itemId, s.sira]));
  const gorunen = veri.maddeler.filter((m) => konum.has(m.id));
  const enFazla = Math.max(...suan.siralar.map((s) => s.sira));

  const tarihYazi = new Date(suan.tarih).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
  });

  return (
    <section className="yaris">
      <div className="yaris-ust">
        <div>
          <span className="eyebrow">Sıralama yarışı</span>
          <h2>{baslik} — son {veri.kareler.length} gün</h2>
        </div>
        <span className="yaris-tarih font-num">{tarihYazi}</span>
      </div>

      {!veri.hareketVar && (
        <p className="form-note" style={{ marginTop: 0 }}>
          Bu dönemde sıralama hiç değişmedi — oynatım düz gider. Oy verdikçe
          hareketlenecek.
        </p>
      )}

      <div className="yaris-pist" style={{ height: enFazla * SATIR_Y }}>
        {gorunen.map((m) => {
          const sira = konum.get(m.id)!;
          return (
            <div
              key={m.id}
              className="yaris-satir"
              style={{ transform: `translateY(${(sira - 1) * SATIR_Y}px)` }}
            >
              <span className="yaris-no font-num">{sira}</span>
              <span className="yaris-ad">{m.ad}</span>
              <span
                className="yaris-cubuk"
                style={{
                  width: `${Math.max(6, ((enFazla - sira + 1) / enFazla) * 100)}%`,
                  background: renkler.get(m.id),
                }}
              />
            </div>
          );
        })}
      </div>

      <div className="yaris-kontrol">
        <button className="btn btn-sm btn-primary" onClick={oynat}>
          {oynuyor ? "⏸ Duraklat" : kare >= sonKare ? "↻ Baştan oynat" : "▶ Oynat"}
        </button>
        <input
          type="range"
          min={0}
          max={sonKare}
          value={Math.min(kare, sonKare)}
          onChange={(ev) => {
            durdur();
            setKare(Number(ev.target.value));
          }}
          aria-label="Gün seç"
          className="yaris-surgu"
        />
        <span className="dim font-num">
          {Math.min(kare, sonKare) + 1}/{veri.kareler.length}
        </span>
      </div>
    </section>
  );
}
