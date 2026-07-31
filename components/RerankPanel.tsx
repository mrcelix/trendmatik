"use client";

import { useState, useTransition } from "react";
import { saveRerankAction } from "@/lib/actions";

type Madde = { id: number; name: string };

/**
 * Kişisel sıralama paneli.
 * Üye maddeleri ▲▼ ile kendi tercihine göre dizer ve kaydeder.
 * Sürükle-bırak yerine düğme kullanılıyor: klavye ve dokunmatikte de çalışır.
 */
export default function RerankPanel({
  slug,
  maddeler,
  mevcutSira,
}: {
  slug: string;
  maddeler: Madde[];
  mevcutSira: number[];
}) {
  // Kayıtlı sıra varsa onunla başla, yoksa topluluk sırasıyla
  const baslangic =
    mevcutSira.length > 0
      ? [
          ...mevcutSira
            .map((id) => maddeler.find((m) => m.id === id))
            .filter((m): m is Madde => !!m),
          ...maddeler.filter((m) => !mevcutSira.includes(m.id)),
        ]
      : maddeler;

  const [sira, setSira] = useState<Madde[]>(baslangic);
  const [kaydediliyor, basla] = useTransition();
  const [degisti, setDegisti] = useState(false);

  function tasi(index: number, yon: -1 | 1) {
    const hedef = index + yon;
    if (hedef < 0 || hedef >= sira.length) return;
    const yeni = [...sira];
    [yeni[index], yeni[hedef]] = [yeni[hedef], yeni[index]];
    setSira(yeni);
    setDegisti(true);
  }

  function sifirla() {
    setSira(maddeler);
    setDegisti(true);
  }

  return (
    <div className="rerank">
      <ol className="rerank-list">
        {sira.map((m, i) => (
          <li key={m.id}>
            <span className="rerank-no font-num">{i + 1}</span>
            <span className="rerank-ad">{m.name}</span>
            <span className="rerank-btns">
              <button
                onClick={() => tasi(i, -1)}
                disabled={i === 0 || kaydediliyor}
                aria-label={`${m.name} yukarı`}
                title="Yukarı taşı"
              >
                ▲
              </button>
              <button
                onClick={() => tasi(i, 1)}
                disabled={i === sira.length - 1 || kaydediliyor}
                aria-label={`${m.name} aşağı`}
                title="Aşağı taşı"
              >
                ▼
              </button>
            </span>
          </li>
        ))}
      </ol>

      <div className="rerank-alt">
        <button className="btn btn-sm" onClick={sifirla} disabled={kaydediliyor}>
          Topluluk sırasına dön
        </button>
        <button
          className="btn btn-primary"
          disabled={!degisti || kaydediliyor}
          onClick={() =>
            basla(async () => {
              await saveRerankAction(slug, sira.map((m) => m.id));
              setDegisti(false);
            })
          }
        >
          {kaydediliyor ? "Kaydediliyor…" : mevcutSira.length ? "Sıralamamı güncelle" : "Sıralamamı kaydet"}
        </button>
      </div>
    </div>
  );
}
