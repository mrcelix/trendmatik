"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { duelloAction } from "@/lib/actions";

type Madde = { id: number; name: string; elo: number };

/**
 * İkili karşılaştırma: "A mı B mi?"
 * Tek soruluk karar, up/down oydan daha çok bilgi taşır ve Elo ile birikir.
 * En az maç yapmış maddeler öncelikli eşleşir; böylece puanlar hızla oturur.
 */
export default function DuelWidget({
  slug,
  maddeler,
  kalanHak,
  ilkCift,
}: {
  slug: string;
  maddeler: Madde[];
  kalanHak: number;
  /** İlk çift sunucuda seçilir; widget ilk boyamada dolu gelir. */
  ilkCift: [Madde, Madde] | null;
}) {
  const [cift, setCift] = useState<[Madde, Madde] | null>(ilkCift);
  const [kalan, setKalan] = useState(kalanHak);
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [secilen, setSecilen] = useState<number | null>(null);
  const [bekliyor, basla] = useTransition();

  const yeniCift = useCallback(() => {
    if (maddeler.length < 2) return;
    const karisik = [...maddeler].sort(() => Math.random() - 0.5);
    setCift([karisik[0], karisik[1]]);
    setSecilen(null);
  }, [maddeler]);

  function sec(kazanan: Madde, kaybeden: Madde) {
    if (bekliyor || kalan <= 0) return;
    setSecilen(kazanan.id);
    basla(async () => {
      const sonuc = await duelloAction(slug, kazanan.id, kaybeden.id);
      if (!sonuc.ok) {
        setMesaj(sonuc.mesaj ?? "Kaydedilemedi.");
        if (sonuc.kalan === 0) setKalan(0);
        return;
      }
      setKalan(sonuc.kalan ?? kalan - 1);
      setMesaj(null);
      setTimeout(yeniCift, 350);
    });
  }

  // Klavye: ← / 1 solu, → / 2 sağı seçer, boşluk çifti atlar.
  // Sayfada tek düello bölümü olduğu ve bu tuşlar başka bir şeyle çakışmadığı
  // için görünürlük hesabı yapılmaz; yalnızca yazı yazılırken devre dışı kalır.
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      const hedef = e.target as HTMLElement | null;
      if (hedef && ["INPUT", "TEXTAREA", "SELECT"].includes(hedef.tagName)) return;
      if (hedef?.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (!cift || bekliyor || kalan <= 0) return;

      if (e.key === "ArrowLeft" || e.key === "1") {
        e.preventDefault();
        sec(cift[0], cift[1]);
      } else if (e.key === "ArrowRight" || e.key === "2") {
        e.preventDefault();
        sec(cift[1], cift[0]);
      } else if (e.key === " ") {
        e.preventDefault();
        yeniCift();
      }
    };
    document.addEventListener("keydown", tus);
    return () => document.removeEventListener("keydown", tus);
  });

  if (maddeler.length < 2) {
    return <p className="admin-empty">Karşılaştırma için en az iki madde gerekli.</p>;
  }

  if (kalan <= 0) {
    return (
      <div className="duello duello-bitti">
        <p>
          <b>Bugünlük düello hakkın doldu.</b> Yarın {maddeler.length} madde seni yeniden bekliyor.
        </p>
      </div>
    );
  }

  return (
    <div className="duello">
      <div className="duello-ust">
        <span className="duello-soru">Hangisi daha çok hak ediyor?</span>
        <span className="duello-hak font-num">{kalan} hak</span>
      </div>

      <div className="duello-alan">
        {cift?.map((m, i) => (
          <div key={m.id} style={{ display: "contents" }}>
            {i === 1 && <span className="duello-vs">VS</span>}
            <button
              className={`duello-kart ${secilen === m.id ? "secildi" : ""}`}
              onClick={() => cift && sec(m, cift[1 - i])}
              disabled={bekliyor}
            >
              <span className="dk-ad">{m.name}</span>
              <span className="dk-elo font-num">{m.elo}</span>
            </button>
          </div>
        ))}
      </div>

      <div className="duello-alt">
        <button className="btn btn-sm" onClick={yeniCift} disabled={bekliyor}>
          Bu ikisini atla
        </button>
        {mesaj ? (
          <span className="duello-mesaj">{mesaj}</span>
        ) : (
          <span className="duello-ipucu">
            <kbd className="hs-kbd">←</kbd> <kbd className="hs-kbd">→</kbd> seç ·{" "}
            <kbd className="hs-kbd">boşluk</kbd> atla
          </span>
        )}
      </div>
    </div>
  );
}
