"use client";

import { useState, useTransition } from "react";
import { saveRerankAction } from "@/lib/actions";

type Madde = { id: number; name: string };

/**
 * Kişisel sıralama paneli.
 * Üye maddeleri ▲▼ ile kendi tercihine göre dizer ve kaydeder.
 * Sürükle-bırak yerine düğme kullanılıyor: klavye ve dokunmatikte de çalışır.
 */
/**
 * Uyum skoru — sunucudaki uyumSkoru() ile aynı kural, istemcide anlık
 * gösterim için. Kalıcı değer sunucuda hesaplanır.
 */
function uyum(kisisel: number[], topluluk: number[]): number | null {
  const ortak = kisisel.filter((id) => topluluk.includes(id));
  if (ortak.length < 3) return null;
  const kDizi = kisisel.filter((id) => ortak.includes(id));
  const tDizi = topluluk.filter((id) => ortak.includes(id));
  const n = ortak.length;
  const toplam = ortak.reduce(
    (s, id) => s + Math.abs(kDizi.indexOf(id) - tDizi.indexOf(id)),
    0
  );
  const enKotu = Math.floor((n * n) / 2);
  return enKotu === 0 ? 100 : Math.max(0, Math.min(100, Math.round((1 - toplam / enKotu) * 100)));
}

export default function RerankPanel({
  slug,
  baslik,
  kullanici,
  maddeler,
  mevcutSira,
}: {
  slug: string;
  baslik: string;
  /** Giriş yapmış üyenin görünen adı — paylaşım kartı adresinde kullanılır */
  kullanici: string;
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
  const [kayitli, setKayitli] = useState(mevcutSira.length > 0);

  const toplulukSirasi = maddeler.map((m) => m.id);
  const skor = uyum(sira.map((m) => m.id), toplulukSirasi);

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

  const paylasimMetni = `"${baslik}" listesini kendim sıraladım — toplulukla uyumum %${skor ?? 0}. Sen nasıl sıralardın?`;
  const paylasimAdresi = typeof window !== "undefined"
    ? `${window.location.origin}/liste/${slug}?sirala=${encodeURIComponent(kullanici)}`
    : "";

  return (
    <div className="rerank">
      {skor !== null && (
        <div className="uyum-kutu">
          <div className={`uyum-halka seviye-${skor >= 70 ? "yuksek" : skor >= 40 ? "orta" : "dusuk"}`}>
            <b>%{skor}</b>
          </div>
          <div className="uyum-metin">
            <b>Toplulukla uyumun</b>
            <span>
              {skor >= 70
                ? "Çoğunlukla aynı fikirdesin."
                : skor >= 40
                  ? "Bazı maddelerde ayrışıyorsun."
                  : "Topluluğun tam tersini düşünüyorsun."}
            </span>
          </div>
        </div>
      )}

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
              setKayitli(true);
            })
          }
        >
          {kaydediliyor ? "Kaydediliyor…" : kayitli ? "Sıralamamı güncelle" : "Sıralamamı kaydet"}
        </button>
      </div>

      {/* Paylaşım yalnızca kaydedilmiş sıralamalarda: kart sunucudaki
          veriden üretiliyor, kaydedilmemiş sıra kartta görünmez. */}
      {kayitli && !degisti && (
        <div className="rerank-paylas">
          <span>Sıralamanı paylaş:</span>
          <a
            className="btn btn-sm"
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(paylasimMetni)}&url=${encodeURIComponent(paylasimAdresi)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            𝕏
          </a>
          <a
            className="btn btn-sm"
            href={`https://wa.me/?text=${encodeURIComponent(`${paylasimMetni} ${paylasimAdresi}`)}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            WhatsApp
          </a>
          <button
            className="btn btn-sm"
            onClick={() => navigator.clipboard?.writeText(paylasimAdresi)}
          >
            Bağlantıyı kopyala
          </button>
          <a
            className="btn btn-sm"
            href={`/api/kart/sirala/${slug}?u=${encodeURIComponent(kullanici)}`}
            target="_blank"
            rel="noopener noreferrer"
            title="Paylaşım kartını görüntüle"
          >
            Kartı gör
          </a>
        </div>
      )}
    </div>
  );
}
