"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Category, MenuTopic } from "@/lib/db";

/**
 * Üst bardaki "Kategoriler" mega menüsü.
 * Tıklamayla açılır; Escape, dışarı tıklama ve sayfa değişiminde kapanır.
 * Panel sekmeli: solda kategoriler, sağda o kategorinin listeleri.
 */
export default function MegaMenu({
  categories,
  topics,
  kategoriSayilari,
  toplamListe,
  araclar,
}: {
  categories: Category[];
  /** Kategori başına en popüler 12 liste */
  topics: MenuTopic[];
  kategoriSayilari: Record<string, number>;
  toplamListe: number;
  /**
   * Mobilde üst şerit gizlendiği için il seçici ve tema düğmesi
   * panelin içine alınıyor; masaüstünde bu bölüm gizli.
   */
  araclar?: React.ReactNode;
}) {
  const [acik, setAcik] = useState(false);
  const [aktif, setAktif] = useState(categories[0]?.slug ?? "");
  const [bagli, setBagli] = useState(false);
  const sarmal = useRef<HTMLDivElement>(null);
  const yol = usePathname();

  // Perde body'ye taşınır: üst barda backdrop-filter olduğu için header,
  // fixed konumlu çocuklar için kapsayıcı blok oluşturuyor ve perde
  // header'ın içine hapsolurdu (bkz. HeaderSearch'teki aynı not).
  useEffect(() => setBagli(true), []);

  // Sayfa değişince kapan
  useEffect(() => {
    setAcik(false);
  }, [yol]);

  // Escape + dışarı tıklama
  useEffect(() => {
    if (!acik) return;
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcik(false);
    };
    const tikla = (e: MouseEvent) => {
      if (sarmal.current && !sarmal.current.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener("keydown", tus);
    document.addEventListener("mousedown", tikla);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("mousedown", tikla);
    };
  }, [acik]);

  // topics zaten kategori başına en popüler 12 listeyi içeriyor (bkz. getMenuData)
  const aktifListeler = topics.filter((t) => t.categorySlug === aktif);
  const enCokOylanan = [...topics].sort((a, b) => b.voteCount - a.voteCount).slice(0, 3);

  const sayi = (slug: string) => kategoriSayilari[slug] ?? 0;
  const kesildi = sayi(aktif) > aktifListeler.length;

  return (
    <div className="mega" ref={sarmal}>
      {/* Arka planı karartıp bulanıklaştıran perde. z-index header'ın altında
          kalır ki menü paneli ve üst bar net görünsün. */}
      {acik && bagli &&
        createPortal(
          <div className="perde" onClick={() => setAcik(false)} aria-hidden="true" />,
          document.body
        )}

      <button
        className={`mega-trigger ${acik ? "acik" : ""}`}
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        aria-haspopup="true"
      >
        {/* Dar ekranda yalnızca ikon kalır; etiket üst barın taşmasına yol açıyordu */}
        <span className="mega-ikon" aria-hidden="true">☰</span>
        <span className="mega-etiket">Kategoriler</span>
        <span className="mega-count">{toplamListe}</span>
        <span className="mega-caret" aria-hidden="true">
          ▾
        </span>
      </button>

      {acik && (
        <div className="mega-panel" role="dialog" aria-label="Kategoriler menüsü">
          {araclar && <div className="mega-arac">{araclar}</div>}
          <div className="mega-inner">
            {/* Sol: kategoriler */}
            <nav className="mega-cats" aria-label="Kategoriler">
              {categories.map((c) => (
                <button
                  key={c.id}
                  className={`mega-cat ${aktif === c.slug ? "secili" : ""}`}
                  onMouseEnter={() => setAktif(c.slug)}
                  onFocus={() => setAktif(c.slug)}
                  onClick={() => setAktif(c.slug)}
                >
                  <span className="mc-emoji">{c.emoji}</span>
                  <span className="mc-ad">{c.name}</span>
                  <span className="mc-sayi">{sayi(c.slug)}</span>
                </button>
              ))}
              <Link href="/arsiv" className="mega-cat mega-cat-alt">
                <span className="mc-emoji">🏆</span>
                <span className="mc-ad">Zirve Arşivi</span>
              </Link>
            </nav>

            {/* Orta: seçili kategorinin listeleri */}
            <div className="mega-lists">
              <div className="mega-lists-head">
                <span className="eyebrow">
                  {categories.find((c) => c.slug === aktif)?.name} listeleri
                </span>
                <Link href={`/kategori/${aktif}`} className="mega-all">
                  Tümünü gör →
                </Link>
              </div>
              <div className="mega-grid">
                {aktifListeler.map((t) => (
                  <Link key={t.id} href={`/liste/${t.slug}`} className="mega-item">
                    <b>{t.title}</b>
                    <small>
                      {t.city ? `${t.city} · ` : ""}
                      {t.voteCount} oy
                    </small>
                  </Link>
                ))}
                {aktifListeler.length === 0 && (
                  <p className="finder-empty">Bu kategoride henüz liste yok.</p>
                )}
                {kesildi && (
                  <Link href={`/kategori/${aktif}`} className="mega-item mega-item-daha">
                    <b>+{sayi(aktif) - aktifListeler.length} liste daha</b>
                    <small>tümünü gör →</small>
                  </Link>
                )}
              </div>
            </div>

            {/* Sağ: öne çıkanlar */}
            <aside className="mega-feature">
              <span className="eyebrow">En çok oylananlar</span>
              {enCokOylanan.map((t, i) => (
                <Link key={t.id} href={`/liste/${t.slug}`} className="mega-feat-item">
                  <span className="mf-rank">{i + 1}</span>
                  <span className="mf-main">
                    <b>{t.title}</b>
                    <small>{t.voteCount} oy</small>
                  </span>
                </Link>
              ))}
              <Link href="/oner" className="btn btn-primary mega-cta">
                + Yeni başlık öner
              </Link>
            </aside>
          </div>
        </div>
      )}
    </div>
  );
}
