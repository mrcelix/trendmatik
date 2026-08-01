"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category, MenuItem, MenuTopic, MenuYazi } from "@/lib/db";

/**
 * Gelişmiş arama penceresi.
 * Tıklamayla, ⌘K/Ctrl+K ya da "/" ile açılır; arka planı bulanıklaştırır.
 * En az 3 harf yazılınca otomatik arar. Tür, kategori ve şehir süzgeçleri var.
 * Klavye: ↑↓ gezinme, ↵ açma, Esc kapatma.
 */

const MIN_HARF = 3;

type Sonuc = {
  anahtar: string;
  tur: "liste" | "madde" | "yazi";
  baslik: string;
  alt: string;
  href: string;
  simge: string;
};

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c);
}

export default function HeaderSearch({
  topics,
  items,
  yazilar,
  categories,
}: {
  topics: MenuTopic[];
  items: MenuItem[];
  yazilar: MenuYazi[];
  categories: Category[];
}) {
  const [acik, setAcik] = useState(false);
  const [q, setQ] = useState("");
  const [tur, setTur] = useState<"hepsi" | "liste" | "madde" | "yazi">("hepsi");
  const [kategori, setKategori] = useState("");
  const [sehir, setSehir] = useState("");
  const [secili, setSecili] = useState(0);
  const [bagli, setBagli] = useState(false);

  const girdi = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Kaplama body'ye taşınır: üst barda backdrop-filter olduğu için header,
  // fixed konumlu çocuklar için kapsayıcı blok oluşturuyor ve kaplama
  // header'ın içine hapsoluyordu (yalnızca üst bar bulanıklaşıyordu).
  useEffect(() => setBagli(true), []);

  const sehirler = useMemo(
    () => [...new Set(topics.map((t) => t.city).filter((c): c is string => !!c))].sort(),
    [topics]
  );

  const kapat = useCallback(() => {
    setAcik(false);
    setQ("");
    setSecili(0);
  }, []);

  const ac = useCallback(() => {
    setAcik(true);
    setTimeout(() => girdi.current?.focus(), 30);
  }, []);

  // ⌘K / Ctrl+K her yerde açar
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        ac();
      }
    };
    document.addEventListener("keydown", tus);
    return () => document.removeEventListener("keydown", tus);
  }, [ac]);

  // Pencere açıkken arka plan kaymasın
  useEffect(() => {
    if (!acik) return;
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = eski;
    };
  }, [acik]);

  const sonuclar = useMemo<Sonuc[]>(() => {
    const a = normalize(q.trim());
    if (a.length < MIN_HARF) return [];

    const listeler: Sonuc[] =
      tur === "hepsi" || tur === "liste"
        ? topics
            .filter(
              (t) =>
                normalize(t.title).includes(a) &&
                (!kategori || t.categorySlug === kategori) &&
                (!sehir || t.city === sehir)
            )
            .slice(0, 6)
            .map((t) => ({
              anahtar: `l-${t.id}`,
              tur: "liste" as const,
              baslik: t.title,
              alt: `${t.voteCount} oy${t.city ? ` · ${t.city}` : ""}`,
              href: `/liste/${t.slug}`,
              simge: "📋",
            }))
        : [];

    const maddeler: Sonuc[] =
      tur === "hepsi" || tur === "madde"
        ? items
            .filter(
              (i) =>
                normalize(i.name).includes(a) &&
                (!kategori || i.categorySlug === kategori) &&
                (!sehir || i.city === sehir)
            )
            .slice(0, 8)
            .map((i) => ({
              anahtar: `m-${i.id}`,
              tur: "madde" as const,
              baslik: i.name,
              alt: i.topicTitle,
              href: `/liste/${i.topicSlug}#madde-${i.id}`,
              simge: "▪️",
            }))
        : [];

    // Yazılar kategori/şehir süzgecinden etkilenmez
    const bulunanYazilar: Sonuc[] =
      (tur === "hepsi" || tur === "yazi") && !kategori && !sehir
        ? yazilar
            .filter((y) => normalize(y.baslik).includes(a) || normalize(y.ozet).includes(a))
            .slice(0, 4)
            .map((y) => ({
              anahtar: `y-${y.id}`,
              tur: "yazi" as const,
              baslik: y.baslik,
              alt: y.ozet.slice(0, 70) || "Blog yazısı",
              href: `/blog/${y.slug}`,
              simge: "📝",
            }))
        : [];

    return [...listeler, ...maddeler, ...bulunanYazilar];
  }, [q, tur, kategori, sehir, topics, items, yazilar]);

  useEffect(() => setSecili(0), [q, tur, kategori, sehir]);

  // Pencere içi klavye gezinmesi
  function pencereTus(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.stopPropagation();
      kapat();
      return;
    }
    if (!sonuclar.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSecili((s) => (s + 1) % sonuclar.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSecili((s) => (s - 1 + sonuclar.length) % sonuclar.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const hedef = sonuclar[secili];
      if (hedef) {
        kapat();
        router.push(hedef.href);
      }
    }
  }

  const suzgecVar = tur !== "hepsi" || kategori || sehir;
  const azHarf = q.trim().length > 0 && q.trim().length < MIN_HARF;

  return (
    <>
      <button className="hsearch-trigger" onClick={ac} aria-label="Ara">
        <span aria-hidden="true">🔎</span>
        <span className="hs-ph">Başlık, madde, yazı ara…</span>
        <kbd className="hs-kbd">⌘K</kbd>
      </button>

      {acik && bagli && createPortal(
        <div className="ara-katman" onClick={kapat} onKeyDown={pencereTus}>
          <div
            className="ara-pencere"
            role="dialog"
            aria-label="Gelişmiş arama"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="ara-girdi">
              <span aria-hidden="true">🔎</span>
              <input
                ref={girdi}
                type="text"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="En az 3 harf yaz — liste, madde ya da yazı ara"
                aria-label="Arama terimi"
              />
              <kbd className="hs-kbd">esc</kbd>
            </div>

            {/* Gelişmiş süzgeçler */}
            <div className="ara-suzgec">
              <div className="chip-row">
                {(
                  [
                    ["hepsi", "Hepsi"],
                    ["liste", "📋 Listeler"],
                    ["madde", "▪️ Maddeler"],
                    ["yazi", "📝 Yazılar"],
                  ] as const
                ).map(([id, ad]) => (
                  <button
                    key={id}
                    className={`chip ${tur === id ? "secili" : ""}`}
                    onClick={() => setTur(id)}
                    type="button"
                  >
                    {ad}
                  </button>
                ))}
              </div>
              <div className="ara-secimler">
                <select value={kategori} onChange={(e) => setKategori(e.target.value)} aria-label="Kategori">
                  <option value="">Tüm kategoriler</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.slug}>
                      {c.emoji} {c.name}
                    </option>
                  ))}
                </select>
                <select value={sehir} onChange={(e) => setSehir(e.target.value)} aria-label="Şehir">
                  <option value="">Tüm şehirler</option>
                  {sehirler.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
                {suzgecVar && (
                  <button
                    className="btn btn-sm"
                    type="button"
                    onClick={() => {
                      setTur("hepsi");
                      setKategori("");
                      setSehir("");
                    }}
                  >
                    Süzgeçleri temizle
                  </button>
                )}
              </div>
            </div>

            <div className="ara-govde">
              {q.trim().length === 0 && (
                <p className="finder-empty">
                  Aramaya başlamak için yazmaya başla. ↑↓ ile gez, ↵ ile aç, Esc ile kapat.
                </p>
              )}
              {azHarf && (
                <p className="finder-empty">
                  Otomatik arama için en az {MIN_HARF} harf gerekli ({q.trim().length}/{MIN_HARF}).
                </p>
              )}
              {!azHarf && q.trim().length >= MIN_HARF && sonuclar.length === 0 && (
                <p className="finder-empty">
                  &quot;{q.trim()}&quot; için sonuç yok{suzgecVar && " — süzgeçleri temizlemeyi dene"}.
                </p>
              )}

              {sonuclar.map((s, i) => (
                <Link
                  key={s.anahtar}
                  href={s.href}
                  className={`ara-sonuc ${i === secili ? "secili" : ""}`}
                  onClick={kapat}
                  onMouseEnter={() => setSecili(i)}
                >
                  <span className="fr-emoji">{s.simge}</span>
                  <span className="fr-main">
                    <b>{s.baslik}</b>
                    <small>{s.alt}</small>
                  </span>
                  <span className="fr-go">↵</span>
                </Link>
              ))}
            </div>

            {sonuclar.length > 0 && (
              <div className="ara-alt">
                <span>{sonuclar.length} sonuç</span>
                <span>
                  <kbd className="hs-kbd">↑↓</kbd> gez · <kbd className="hs-kbd">↵</kbd> aç ·{" "}
                  <kbd className="hs-kbd">esc</kbd> kapat
                </span>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
