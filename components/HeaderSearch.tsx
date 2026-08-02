"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Category } from "@/lib/db";

/**
 * Gelişmiş arama penceresi.
 * Tıklamayla, ⌘K/Ctrl+K ya da "/" ile açılır; arka planı bulanıklaştırır.
 * En az 3 harf yazılınca otomatik arar. Tür, kategori ve şehir süzgeçleri var.
 * Klavye: ↑↓ gezinme, ↵ açma, Esc kapatma.
 *
 * Arama sunucuda yapılıyor (/api/ara). Dizin istemciye gönderilmiyor:
 * binlerce madde her sayfanın HTML'ine gömülünce sayfa ağırlığı
 * megabaytlara çıkıyordu.
 */

const MIN_HARF = 3;
const BEKLEME_MS = 220;

type Sonuc = {
  anahtar: string;
  tur: "liste" | "madde" | "yazi";
  baslik: string;
  alt: string;
  href: string;
  simge: string;
};

const SIMGE: Record<Sonuc["tur"], string> = { liste: "📋", madde: "▪️", yazi: "📝" };

export default function HeaderSearch({
  sehirler,
  categories,
}: {
  sehirler: string[];
  categories: Category[];
}) {
  const [acik, setAcik] = useState(false);
  const [q, setQ] = useState("");
  const [tur, setTur] = useState<"hepsi" | "liste" | "madde" | "yazi">("hepsi");
  const [kategori, setKategori] = useState("");
  const [sehir, setSehir] = useState("");
  const [secili, setSecili] = useState(0);
  const [bagli, setBagli] = useState(false);
  const [sonuclar, setSonuclar] = useState<Sonuc[]>([]);
  const [araniyor, setAraniyor] = useState(false);

  const girdi = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Kaplama body'ye taşınır: üst barda backdrop-filter olduğu için header,
  // fixed konumlu çocuklar için kapsayıcı blok oluşturuyor ve kaplama
  // header'ın içine hapsoluyordu (yalnızca üst bar bulanıklaşıyordu).
  useEffect(() => setBagli(true), []);

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

  // Sunucu araması: yazma durunca istek atılır, önceki istek iptal edilir
  useEffect(() => {
    const terim = q.trim();
    if (terim.length < MIN_HARF) {
      setSonuclar([]);
      setAraniyor(false);
      return;
    }

    const kontrol = new AbortController();
    setAraniyor(true);
    const zamanlayici = setTimeout(async () => {
      try {
        const p = new URLSearchParams({ q: terim });
        if (tur !== "hepsi") p.set("tur", tur);
        if (kategori) p.set("kategori", kategori);
        if (sehir) p.set("sehir", sehir);

        const cevap = await fetch(`/api/ara?${p}`, { signal: kontrol.signal });
        const veri = (await cevap.json()) as {
          sonuclar: { tur: Sonuc["tur"]; id: number; baslik: string; alt: string; href: string }[];
        };
        setSonuclar(
          veri.sonuclar.map((s) => ({
            anahtar: `${s.tur}-${s.id}`,
            tur: s.tur,
            baslik: s.baslik,
            alt: s.alt,
            href: s.href,
            simge: SIMGE[s.tur],
          }))
        );
      } catch {
        // İptal edilen istekler ve ağ hataları sessizce geçilir
      } finally {
        if (!kontrol.signal.aborted) setAraniyor(false);
      }
    }, BEKLEME_MS);

    return () => {
      clearTimeout(zamanlayici);
      kontrol.abort();
    };
  }, [q, tur, kategori, sehir]);

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
              {!azHarf && q.trim().length >= MIN_HARF && araniyor && sonuclar.length === 0 && (
                <p className="finder-empty">Aranıyor…</p>
              )}
              {!azHarf && q.trim().length >= MIN_HARF && !araniyor && sonuclar.length === 0 && (
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
