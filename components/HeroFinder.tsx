"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category, HeroTopic } from "@/lib/db";

/**
 * Hero'daki etkileşimli bulucu.
 * Adımlar: ① Kategori → ② Başlık → ③ Sıralama.
 * Arama üst barda olduğu için burada tekrarlanmaz.
 * Tüm veri sunucudan tek seferde gelir; adımlar arası gezinme anlıktır.
 */

const MADALYA = ["🥇", "🥈", "🥉"];

export default function HeroFinder({
  categories,
  topics,
}: {
  categories: Category[];
  topics: HeroTopic[];
}) {
  const [kategori, setKategori] = useState<string | null>(null);
  const [baslikId, setBaslikId] = useState<number | null>(null);

  // Kategoriye göre başlıklar (popülerlik sırasıyla)
  const kategoriBasliklari = useMemo(() => {
    const liste = kategori ? topics.filter((t) => t.categorySlug === kategori) : topics;
    return [...liste].sort((a, b) => b.popScore - a.popScore);
  }, [kategori, topics]);

  const secili = useMemo(
    () => topics.find((t) => t.id === baslikId) ?? kategoriBasliklari[0] ?? null,
    [baslikId, kategoriBasliklari, topics]
  );

  const adim = kategori === null ? 1 : baslikId === null ? 2 : 3;

  return (
    <div className="finder">
      <div className="finder-head">
        <div>
          <span className="finder-title">Ne trend olduğunu bul</span>
          <span className="finder-sub">Kategori seç, listeyi gör, oy ver</span>
        </div>
        <span className="finder-badge">10 saniye</span>
      </div>

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
          Başlık <em>· {kategoriBasliklari.length} liste</em>
        </span>
        <div className="chip-row">
          {kategoriBasliklari.map((t) => (
            <button
              key={t.id}
              className={`chip ${secili?.id === t.id ? "secili" : ""}`}
              onClick={() => setBaslikId(t.id)}
              title={t.title}
            >
              {t.title}
            </button>
          ))}
          {kategoriBasliklari.length === 0 && (
            <span className="finder-empty">Bu kategoride henüz liste yok.</span>
          )}
        </div>
      </div>

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
    </div>
  );
}
