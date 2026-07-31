"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { MenuItem, MenuTopic } from "@/lib/db";

/**
 * Üst bardaki arama. Tıklamayla ya da ⌘K / Ctrl+K ile açılır,
 * başlıklarda ve maddelerde arar, Escape ile kapanır.
 */

function normalize(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşü]/g, (c) => ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c);
}

export default function HeaderSearch({
  topics,
  items,
}: {
  topics: MenuTopic[];
  items: MenuItem[];
}) {
  const [acik, setAcik] = useState(false);
  const [q, setQ] = useState("");
  const kutu = useRef<HTMLDivElement>(null);
  const girdi = useRef<HTMLInputElement>(null);
  const yol = usePathname();

  useEffect(() => {
    setAcik(false);
    setQ("");
  }, [yol]);

  // ⌘K / Ctrl+K ile aç, Escape ile kapat
  useEffect(() => {
    const tus = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setAcik(true);
        setTimeout(() => girdi.current?.focus(), 20);
      }
      if (e.key === "Escape") setAcik(false);
    };
    document.addEventListener("keydown", tus);
    return () => document.removeEventListener("keydown", tus);
  }, []);

  useEffect(() => {
    if (!acik) return;
    const tikla = (e: MouseEvent) => {
      if (kutu.current && !kutu.current.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener("mousedown", tikla);
    return () => document.removeEventListener("mousedown", tikla);
  }, [acik]);

  const sonuc = useMemo(() => {
    const a = normalize(q.trim());
    if (a.length < 2) return null;
    return {
      basliklar: topics.filter((t) => normalize(t.title).includes(a)).slice(0, 5),
      maddeler: items.filter((i) => normalize(i.name).includes(a)).slice(0, 7),
    };
  }, [q, topics, items]);

  return (
    <div className="hsearch" ref={kutu}>
      <button
        className="hsearch-trigger"
        onClick={() => {
          setAcik(true);
          setTimeout(() => girdi.current?.focus(), 20);
        }}
        aria-label="Ara"
      >
        <span aria-hidden="true">🔎</span>
        <span className="hs-ph">Başlık, madde, kategori ara…</span>
        <kbd className="hs-kbd">⌘K</kbd>
      </button>

      {acik && (
        <div className="hsearch-panel" role="dialog" aria-label="Arama">
          <div className="hsearch-input">
            <span aria-hidden="true">🔎</span>
            <input
              ref={girdi}
              type="search"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Başlık veya madde ara…"
              aria-label="Arama terimi"
            />
            <kbd className="hs-kbd">esc</kbd>
          </div>

          <div className="hsearch-body">
            {!sonuc && <p className="finder-empty">En az 2 harf yazın.</p>}
            {sonuc && sonuc.basliklar.length === 0 && sonuc.maddeler.length === 0 && (
              <p className="finder-empty">Eşleşme bulunamadı.</p>
            )}
            {sonuc && sonuc.basliklar.length > 0 && (
              <>
                <span className="finder-group">Listeler</span>
                {sonuc.basliklar.map((t) => (
                  <Link key={t.id} href={`/liste/${t.slug}`} className="finder-result">
                    <span className="fr-emoji">📋</span>
                    <span className="fr-main">
                      <b>{t.title}</b>
                      <small>{t.voteCount} oy</small>
                    </span>
                    <span className="fr-go">→</span>
                  </Link>
                ))}
              </>
            )}
            {sonuc && sonuc.maddeler.length > 0 && (
              <>
                <span className="finder-group">Maddeler</span>
                {sonuc.maddeler.map((i) => (
                  <Link
                    key={i.id}
                    href={`/liste/${i.topicSlug}#madde-${i.id}`}
                    className="finder-result"
                  >
                    <span className="fr-emoji">▪️</span>
                    <span className="fr-main">
                      <b>{i.name}</b>
                      <small>{i.topicTitle}</small>
                    </span>
                    <span className="fr-go">→</span>
                  </Link>
                ))}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
