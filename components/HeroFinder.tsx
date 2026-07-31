"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category, HeroTopic } from "@/lib/db";

/**
 * Hero'daki etkileşimli bulucu.
 * Adımlar: ① Kategori → ② Başlık → ③ Sıralama.
 * Üstteki arama kutusu hem başlıklarda hem alt maddelerde arar; sonuçtan
 * doğrudan ilgili maddeye çapa (#madde-<id>) ile gidilir.
 * Tüm veri sunucudan tek seferde gelir; adımlar arası gezinme anlıktır.
 */

const MADALYA = ["🥇", "🥈", "🥉"];

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c);
}

export default function HeroFinder({
  categories,
  topics,
}: {
  categories: Category[];
  topics: HeroTopic[];
}) {
  const [kategori, setKategori] = useState<string | null>(null);
  const [baslikId, setBaslikId] = useState<number | null>(null);
  const [arama, setArama] = useState("");

  // Kategoriye göre başlıklar (popülerlik sırasıyla)
  const kategoriBasliklari = useMemo(() => {
    const liste = kategori ? topics.filter((t) => t.categorySlug === kategori) : topics;
    return [...liste].sort((a, b) => b.popScore - a.popScore);
  }, [kategori, topics]);

  const secili = useMemo(
    () => topics.find((t) => t.id === baslikId) ?? kategoriBasliklari[0] ?? null,
    [baslikId, kategoriBasliklari, topics]
  );

  // Arama: başlıklarda + alt maddelerde
  const sonuclar = useMemo(() => {
    const q = normalize(arama.trim());
    if (q.length < 2) return null;
    const basliklar = topics.filter((t) => normalize(t.title).includes(q)).slice(0, 4);
    const maddeler: { topic: HeroTopic; item: HeroTopic["items"][number] }[] = [];
    for (const t of topics) {
      for (const it of t.items) {
        if (normalize(it.name).includes(q)) maddeler.push({ topic: t, item: it });
      }
    }
    return { basliklar, maddeler: maddeler.slice(0, 6) };
  }, [arama, topics]);

  const adim = arama.trim().length >= 2 ? 0 : kategori === null ? 1 : baslikId === null ? 2 : 3;

  return (
    <div className="finder">
      <div className="finder-head">
        <div>
          <span className="finder-title">Ne trend olduğunu bul</span>
          <span className="finder-sub">Kategoriden başla ya da doğrudan ara</span>
        </div>
        <span className="finder-badge">10 saniye</span>
      </div>

      <div className="finder-search">
        <span aria-hidden="true">🔎</span>
        <input
          type="search"
          value={arama}
          onChange={(e) => setArama(e.target.value)}
          placeholder="Başlık veya madde ara — örn. kahve, Trendyol, asgari ücret"
          aria-label="Başlık veya madde ara"
        />
        {arama && (
          <button className="finder-clear" onClick={() => setArama("")} aria-label="Aramayı temizle">
            ×
          </button>
        )}
      </div>

      {/* ---- Arama sonuçları ---- */}
      {sonuclar && (
        <div className="finder-results">
          {sonuclar.basliklar.length === 0 && sonuclar.maddeler.length === 0 && (
            <p className="finder-empty">Eşleşme yok. Başka bir kelime deneyin.</p>
          )}
          {sonuclar.basliklar.length > 0 && (
            <>
              <span className="finder-group">Başlıklar</span>
              {sonuclar.basliklar.map((t) => (
                <Link key={t.id} href={`/liste/${t.slug}`} className="finder-result">
                  <span className="fr-emoji">{t.categoryEmoji}</span>
                  <span className="fr-main">
                    <b>{t.title}</b>
                    <small>
                      {t.categoryName}
                      {t.city ? ` · ${t.city}` : ""} · {t.voteCount} oy
                    </small>
                  </span>
                  <span className="fr-go">→</span>
                </Link>
              ))}
            </>
          )}
          {sonuclar.maddeler.length > 0 && (
            <>
              <span className="finder-group">Maddeler</span>
              {sonuclar.maddeler.map(({ topic, item }) => (
                <Link
                  key={item.id}
                  href={`/liste/${topic.slug}#madde-${item.id}`}
                  className="finder-result"
                >
                  <span className="fr-emoji">{topic.categoryEmoji}</span>
                  <span className="fr-main">
                    <b>{item.name}</b>
                    <small>{topic.title}</small>
                  </span>
                  <span className="fr-go">→</span>
                </Link>
              ))}
            </>
          )}
        </div>
      )}

      {/* ---- Adımlar ---- */}
      {!sonuclar && (
        <>
          <ol className="finder-steps">
            {["Kategori", "Başlık", "Sıralama"].map((ad, i) => (
              <li key={ad} className={adim > i + 1 ? "ok" : adim === i + 1 ? "aktif" : ""}>
                <span className="fs-no">{adim > i + 1 ? "✓" : i + 1}</span>
                {ad}
              </li>
            ))}
          </ol>

          <div className="finder-step">
            <span className="finder-label">Kategori</span>
            <div className="chip-row">
              {categories.map((c) => (
                <button
                  key={c.id}
                  className={`chip ${kategori === c.slug ? "secili" : ""}`}
                  onClick={() => {
                    setKategori(kategori === c.slug ? null : c.slug);
                    setBaslikId(null);
                  }}
                >
                  {c.emoji} {c.name}
                </button>
              ))}
            </div>
          </div>

          <div className="finder-step">
            <span className="finder-label">
              Başlık {kategori && <em>· {kategoriBasliklari.length} liste</em>}
            </span>
            <div className="chip-row">
              {kategoriBasliklari.slice(0, 6).map((t) => (
                <button
                  key={t.id}
                  className={`chip ${secili?.id === t.id ? "secili" : ""}`}
                  onClick={() => setBaslikId(t.id)}
                >
                  {t.title}
                </button>
              ))}
              {kategoriBasliklari.length === 0 && (
                <span className="finder-empty">Bu kategoride henüz liste yok.</span>
              )}
            </div>
          </div>

          {/* ---- Sonuç önizleme ---- */}
          {secili && (
            <div className="finder-preview">
              <div className="fp-head">
                <b>{secili.title}</b>
                <span>{secili.voteCount} oy</span>
              </div>
              <ol className="fp-list">
                {secili.items.map((it, i) => (
                  <li key={it.id}>
                    <Link href={`/liste/${secili.slug}#madde-${it.id}`}>
                      <span className="fp-rank">{MADALYA[i] ?? `${i + 1}.`}</span>
                      <span className="fp-name">{it.name}</span>
                      <span className="fp-score font-num">{Math.round(it.pop)}</span>
                    </Link>
                  </li>
                ))}
                {secili.items.length === 0 && <li className="finder-empty">Henüz madde yok.</li>}
              </ol>
              <Link href={`/liste/${secili.slug}`} className="btn btn-gold btn-lg btn-shine fp-cta">
                Listeyi aç ve oy ver →
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}
