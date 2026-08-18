"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { duelloAction } from "@/lib/actions";

/**
 * Şampiyonlar Turu — 8 maddelik eleme.
 *
 * Her eşleşme mevcut düello ucundan geçer (duelloAction): Elo puanları
 * güncellenir, günlük düello sınırı işler. Yani turnuva ayrı bir oyun
 * değil, düellonun sıralı ve hikâyeli hâli — ürettiği veri aynı yere gider.
 *
 * Sekiz madde 1-8, 2-7, 3-6, 4-5 diye eşlenir: en güçlü adaylar finale
 * kadar karşılaşmaz, tur sıralamaya göre anlam kazanır.
 */

export type TurMaddesi = { id: number; ad: string; gorsel: string; sira: number };

const TUR_ADI = ["Çeyrek final", "Yarı final", "Final"];

/** 8 maddede eşleşme sırası: 0-3 çeyrek, 4-5 yarı, 6 final. */
const eslesmeTuru = (i: number) => (i < 4 ? TUR_ADI[0] : i < 6 ? TUR_ADI[1] : TUR_ADI[2]);

export default function SampiyonlarTuru({
  slug,
  listeBasligi,
  maddeler,
}: {
  slug: string;
  listeBasligi: string;
  maddeler: TurMaddesi[];
}) {
  // 1-8, 2-7, 3-6, 4-5
  const ilkTur = useMemo(() => {
    const s = [...maddeler].sort((a, b) => a.sira - b.sira).slice(0, 8);
    const ciftler: [TurMaddesi, TurMaddesi][] = [];
    for (let i = 0; i < s.length / 2; i++) ciftler.push([s[i], s[s.length - 1 - i]]);
    return ciftler;
  }, [maddeler]);

  const [tur, setTur] = useState(0);
  const [eslesme, setEslesme] = useState(0);
  const [kazananlar, setKazananlar] = useState<TurMaddesi[]>([]);
  const [ciftler, setCiftler] = useState<[TurMaddesi, TurMaddesi][]>(ilkTur);
  const [sampiyon, setSampiyon] = useState<TurMaddesi | null>(null);
  const [yol, setYol] = useState<string[]>([]);
  const [uyari, setUyari] = useState<string | null>(null);
  const [bekliyor, setBekliyor] = useState(false);

  const toplamEslesme = ilkTur.length * 2 - 1; // 4 + 2 + 1
  const yapilan = yol.length;

  const sec = useCallback(
    async (kazanan: TurMaddesi, kaybeden: TurMaddesi) => {
      if (bekliyor) return;
      setBekliyor(true);
      setUyari(null);

      // Sonuç Elo'ya yazılır; sınır dolsa bile tur akışı devam eder
      const sonuc = await duelloAction(slug, kazanan.id, kaybeden.id);
      if (!sonuc.ok && sonuc.mesaj) setUyari(sonuc.mesaj);

      const yeniKazananlar = [...kazananlar, kazanan];
      const yeniYol = [...yol, `${kazanan.ad} → ${kaybeden.ad}`];
      setYol(yeniYol);

      if (eslesme + 1 < ciftler.length) {
        setKazananlar(yeniKazananlar);
        setEslesme(eslesme + 1);
      } else if (yeniKazananlar.length === 1) {
        setSampiyon(yeniKazananlar[0]);
      } else {
        // Sonraki tur: kazananlar sırayla eşleşir
        const sonraki: [TurMaddesi, TurMaddesi][] = [];
        for (let i = 0; i < yeniKazananlar.length; i += 2) {
          sonraki.push([yeniKazananlar[i], yeniKazananlar[i + 1]]);
        }
        setCiftler(sonraki);
        setKazananlar([]);
        setEslesme(0);
        setTur(tur + 1);
      }
      setBekliyor(false);
    },
    [bekliyor, slug, kazananlar, yol, eslesme, ciftler.length, tur]
  );

  if (maddeler.length < 8) {
    return (
      <p className="admin-empty">
        Turnuva için en az 8 madde gerekiyor; bu listede {maddeler.length} tane var.
      </p>
    );
  }

  if (sampiyon) {
    return (
      <div className="tur-bitti">
        <div className="tur-kupa" aria-hidden="true">🏆</div>
        <span className="eyebrow">Senin şampiyonun</span>
        <h2>{sampiyon.ad}</h2>
        <p className="dim">{listeBasligi}</p>

        <ol className="tur-yol">
          {yol.map((y, i) => (
            <li key={i}>
              <span className="dim">{eslesmeTuru(i)}</span>
              {y}
            </li>
          ))}
        </ol>

        <div className="tur-dugmeler">
          <Link href={`/liste/${slug}`} className="btn btn-primary btn-lg">
            Listenin geneli ne diyor? →
          </Link>
          <Link href={`/turnuva/${slug}`} className="btn btn-lg">Yeniden oyna</Link>
        </div>
        <p className="form-note">
          Seçimlerin kaydedildi ve maddelerin karşılaşma puanlarına işlendi.
        </p>
      </div>
    );
  }

  const [sol, sag] = ciftler[eslesme];

  return (
    <div className="tur">
      <div className="tur-ust">
        <span className="eyebrow">
          {TUR_ADI[tur] ?? "Tur"} · {eslesme + 1}/{ciftler.length}
        </span>
        <div className="tur-ilerleme" aria-hidden="true">
          <span style={{ width: `${(yapilan / toplamEslesme) * 100}%` }} />
        </div>
      </div>

      <p className="tur-soru">Hangisi bir üst tura çıksın?</p>

      <div className="tur-eslesme">
        {[sol, sag].map((m, i) => (
          <button
            key={m.id}
            className="tur-kart"
            onClick={() => sec(m, i === 0 ? sag : sol)}
            disabled={bekliyor}
          >
            <span className="tur-sira font-num">#{m.sira}</span>
            <span className="tur-ad">{m.ad}</span>
          </button>
        ))}
        <span className="tur-vs" aria-hidden="true">VS</span>
      </div>

      {uyari && <p className="alert-err tur-uyari">{uyari}</p>}

      <p className="form-note tur-not">
        Seçimlerin maddelerin karşılaşma puanına işler — turnuva, düellonun
        sıralı hâli. Toplam {toplamEslesme} eşleşme.
      </p>
    </div>
  );
}
