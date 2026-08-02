"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Tek düğme altında toplanmış paylaşım menüsü.
 *
 * Önceden WhatsApp / X / Bağlantı / Görsel / Göm düğmeleri başlığın altında
 * yan yana duruyordu ve satırı şişiriyordu. Artık "Paylaş" düğmesi bir menü
 * açıyor; gömme kodu da bu menünün içinden çıkıyor.
 */
export default function PaylasMenu({
  url,
  title,
  cardUrl,
  slug,
}: {
  url: string;
  title: string;
  cardUrl: string;
  slug: string;
}) {
  const [acik, setAcik] = useState(false);
  const [kopyalandi, setKopyalandi] = useState(false);
  const [gomme, setGomme] = useState(false);
  const [tema, setTema] = useState<"gunduz" | "gece">("gunduz");
  const [adet, setAdet] = useState(10);
  const [kodKopyalandi, setKodKopyalandi] = useState(false);
  const sarmal = useRef<HTMLDivElement>(null);

  const metin = `${title} — TrendMatik`;

  useEffect(() => {
    if (!acik) return;
    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") { setAcik(false); setGomme(false); }
    };
    const tikla = (e: MouseEvent) => {
      if (sarmal.current && !sarmal.current.contains(e.target as Node)) {
        setAcik(false);
        setGomme(false);
      }
    };
    document.addEventListener("keydown", tus);
    document.addEventListener("mousedown", tikla);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("mousedown", tikla);
    };
  }, [acik]);

  async function kopyala() {
    try {
      await navigator.clipboard.writeText(url);
      setKopyalandi(true);
      setTimeout(() => setKopyalandi(false), 2000);
    } catch {
      /* pano izni yoksa sessizce geç */
    }
  }

  async function cihazlaPaylas() {
    if (!navigator.share) return;
    try {
      await navigator.share({ title: metin, url });
      setAcik(false);
    } catch {
      /* kullanıcı vazgeçti */
    }
  }

  const koken = typeof window !== "undefined" ? window.location.origin : "";
  const gomSrc = `${koken}/gomulu/${slug}?adet=${adet}${tema === "gece" ? "&tema=gece" : ""}`;
  const gomYukseklik = 90 + adet * 40;
  const gomKod = `<iframe src="${gomSrc}" width="100%" height="${gomYukseklik}" style="border:0" loading="lazy" title="${title} — TrendMatik"></iframe>`;

  return (
    <div className="paylas" ref={sarmal}>
      <button
        className={`btn btn-sm ${acik ? "acik" : ""}`}
        onClick={() => setAcik((a) => !a)}
        aria-expanded={acik}
        aria-haspopup="menu"
      >
        ↗ Paylaş <span className="paylas-caret" aria-hidden="true">▾</span>
      </button>

      {acik && (
        <div className="paylas-panel" role="menu">
          {!gomme ? (
            <>
              <a
                className="paylas-oge"
                href={`https://wa.me/?text=${encodeURIComponent(`${metin} ${url}`)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAcik(false)}
              >
                <span aria-hidden="true">💬</span> WhatsApp
              </a>
              <a
                className="paylas-oge"
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(metin)}&url=${encodeURIComponent(url)}`}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAcik(false)}
              >
                <span aria-hidden="true">𝕏</span> X&apos;te paylaş
              </a>
              <button className="paylas-oge" onClick={kopyala}>
                <span aria-hidden="true">{kopyalandi ? "✓" : "🔗"}</span>{" "}
                {kopyalandi ? "Kopyalandı" : "Bağlantıyı kopyala"}
              </button>
              <a
                className="paylas-oge"
                href={cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setAcik(false)}
              >
                <span aria-hidden="true">🖼️</span> Paylaşım görseli
              </a>
              {typeof navigator !== "undefined" && !!navigator.share && (
                <button className="paylas-oge" onClick={cihazlaPaylas}>
                  <span aria-hidden="true">⋯</span> Diğer uygulamalar
                </button>
              )}

              <div className="paylas-ayrac" />
              <button className="paylas-oge" onClick={() => setGomme(true)}>
                <span aria-hidden="true">🧩</span> Bu listeyi sitene göm
              </button>
            </>
          ) : (
            <div className="paylas-gomme">
              <button className="paylas-geri" onClick={() => setGomme(false)}>
                ‹ Geri
              </button>
              <div className="gomme-secenekler">
                <label>
                  Tema
                  <select value={tema} onChange={(e) => setTema(e.target.value as "gunduz" | "gece")}>
                    <option value="gunduz">Açık</option>
                    <option value="gece">Koyu</option>
                  </select>
                </label>
                <label>
                  Madde
                  <select value={adet} onChange={(e) => setAdet(Number(e.target.value))}>
                    {[3, 5, 10].map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                  </select>
                </label>
              </div>
              <iframe
                src={gomSrc}
                width="100%"
                height={Math.min(gomYukseklik, 240)}
                style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--paper)" }}
                title={`${title} önizleme`}
              />
              <textarea className="gomme-kod" readOnly value={gomKod} rows={3} onFocus={(e) => e.currentTarget.select()} />
              <button
                className="btn btn-sm btn-primary"
                onClick={() => {
                  navigator.clipboard?.writeText(gomKod);
                  setKodKopyalandi(true);
                  setTimeout(() => setKodKopyalandi(false), 2000);
                }}
              >
                {kodKopyalandi ? "Kopyalandı ✓" : "Kodu kopyala"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
