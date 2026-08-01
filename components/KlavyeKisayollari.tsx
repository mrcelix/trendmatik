"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * Site geneli klavye kısayolları.
 *
 * Yazı yazarken tetiklenmemesi gereken kısayollar (/, ?) alan içindeyken
 * devre dışı kalır; Escape ve Ctrl+Enter ise bilerek alan içinde çalışır.
 */

const KISAYOLLAR: { tus: string; aciklama: string }[] = [
  { tus: "/", aciklama: "Aramayı aç" },
  { tus: "⌘K / Ctrl+K", aciklama: "Aramayı aç" },
  { tus: "Esc", aciklama: "Açık pencereyi kapat, alandan çık" },
  { tus: "⌘↵ / Ctrl+↵", aciklama: "Bulunduğun formu gönder" },
  { tus: "← →", aciklama: "Düelloda seçim yap" },
  { tus: "Boşluk", aciklama: "Düelloda bu ikisini atla" },
  { tus: "?", aciklama: "Bu listeyi aç/kapat" },
];

/** Odak bir metin alanında mı? */
function alanIcinde(e: EventTarget | null): boolean {
  const el = e as HTMLElement | null;
  if (!el) return false;
  const etiket = el.tagName;
  return (
    etiket === "INPUT" ||
    etiket === "TEXTAREA" ||
    etiket === "SELECT" ||
    el.isContentEditable === true
  );
}

export default function KlavyeKisayollari() {
  const [yardimAcik, setYardimAcik] = useState(false);

  const tus = useCallback((e: KeyboardEvent) => {
    const yazi = alanIcinde(e.target);

    // Escape: yardım açıksa kapat, değilse alandan çık
    if (e.key === "Escape") {
      if (yardimAcik) {
        setYardimAcik(false);
        return;
      }
      if (yazi) (e.target as HTMLElement).blur();
      return;
    }

    // Ctrl/Cmd + Enter: odaktaki alanın formunu gönder
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      const form = (e.target as HTMLElement)?.closest?.("form");
      if (form) {
        e.preventDefault();
        form.requestSubmit();
      }
      return;
    }

    if (yazi || e.metaKey || e.ctrlKey || e.altKey) return;

    // "/" aramayı açar
    if (e.key === "/") {
      const tetik = document.querySelector<HTMLButtonElement>(".hsearch-trigger");
      if (tetik) {
        e.preventDefault();
        tetik.click();
      }
      return;
    }

    // "?" kısayol listesini açar
    if (e.key === "?") {
      e.preventDefault();
      setYardimAcik((a) => !a);
    }
  }, [yardimAcik]);

  useEffect(() => {
    document.addEventListener("keydown", tus);
    return () => document.removeEventListener("keydown", tus);
  }, [tus]);

  if (!yardimAcik) return null;

  return (
    <div className="kisayol-katman" onClick={() => setYardimAcik(false)}>
      <div
        className="kisayol-pencere"
        role="dialog"
        aria-label="Klavye kısayolları"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="kisayol-baslik">
          <b>Klavye kısayolları</b>
          <button
            className="btn btn-sm"
            onClick={() => setYardimAcik(false)}
            aria-label="Kapat"
          >
            Esc
          </button>
        </div>
        <ul className="kisayol-liste">
          {KISAYOLLAR.map((k) => (
            <li key={k.tus}>
              <kbd>{k.tus}</kbd>
              <span>{k.aciklama}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
