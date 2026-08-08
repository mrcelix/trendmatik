"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { Category, HeroTopic } from "@/lib/db";

/**
 * Hero'daki etkileşimli bulucu: kategori seç → başlık seç → sıralamayı gör.
 * Arama üst barda olduğu için burada tekrarlanmaz.
 * Tüm veri sunucudan tek seferde gelir; seçimler arası gezinme anlıktır.
 */

const MADALYA = ["🥇", "🥈", "🥉"];

export default function HeroFinder({
  categories,
  topics,
  kategoriLimit,
}: {
  categories: Category[];
  topics: HeroTopic[];
  /** Bir kategori seçilince gösterilecek en fazla başlık (yönetimden ayarlanır) */
  kategoriLimit: number;
}) {
  const [kategori, setKategori] = useState<string | null>(null);
  const [baslikId, setBaslikId] = useState<number | null>(null);

  // Yöneticinin öne çıkardıkları önce, sonra popülerlik
  const sirala = (liste: HeroTopic[]) =>
    [...liste].sort(
      (a, b) =>
        b.oneCikan - a.oneCikan ||
        (a.oneCikan === 1 ? a.heroSira - b.heroSira : 0) ||
        b.popScore - a.popScore
    );

  const kategoriBasliklari = useMemo(() => {
    // Açılışta kategori başına yalnızca 1 numara: onlarca başlığı bir arada
    // göstermek yerine her kategoriden tek örnek, seçim yapmaya davet eder.
    if (kategori === null) {
      return categories
        .map((c) => sirala(topics.filter((t) => t.categorySlug === c.slug))[0])
        .filter((t): t is HeroTopic => Boolean(t));
    }
    return sirala(topics.filter((t) => t.categorySlug === kategori)).slice(0, kategoriLimit);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kategori, topics, categories, kategoriLimit]);

  const secili = useMemo(
    () => topics.find((t) => t.id === baslikId) ?? kategoriBasliklari[0] ?? null,
    [baslikId, kategoriBasliklari, topics]
  );

  return (
    <div className="finder">
      <div className="finder-head">
        <div>
          <span className="finder-title">Ne trend olduğunu bul</span>
          <span className="finder-sub">Kategori seç, listeyi gör, oy ver</span>
        </div>
        <span className="finder-badge">10 saniye</span>
      </div>

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

      {/* Başlık listesi ile önizleme yan yana: liste uzadıkça sayfa aşağı
          büyümüyor, kendi sütununda kayıyor ve seçili liste hep görünür. */}
      <div className="finder-govde">
      <div className="finder-step finder-basliklar">
        <span className="finder-label">
          Başlık <em>· {kategoriBasliklari.length} liste</em>
        </span>
        <div className="chip-col">
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
          <Link href={`/liste/${secili.slug}`} className="btn btn-gold btn-lg fp-cta">
            Listeyi aç ve oy ver →
          </Link>
        </div>
      )}
      </div>
    </div>
  );
}
