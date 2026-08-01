"use client";

import { useState } from "react";

/**
 * "Bu listeyi sitene göm" kutusu.
 * Tema ve madde sayısı seçilebilir; kod anında güncellenir.
 */
export default function GommeKodu({ slug, baslik }: { slug: string; baslik: string }) {
  const [acik, setAcik] = useState(false);
  const [tema, setTema] = useState<"gunduz" | "gece">("gunduz");
  const [adet, setAdet] = useState(10);
  const [kopyalandi, setKopyalandi] = useState(false);

  const koken = typeof window !== "undefined" ? window.location.origin : "";
  const src = `${koken}/gomulu/${slug}?adet=${adet}${tema === "gece" ? "&tema=gece" : ""}`;
  const yukseklik = 90 + adet * 40;
  const kod = `<iframe src="${src}" width="100%" height="${yukseklik}" style="border:0" loading="lazy" title="${baslik} — TrendMatik"></iframe>`;

  if (!acik) {
    return (
      <button className="btn btn-sm" onClick={() => setAcik(true)}>
        🔗 Bu listeyi sitene göm
      </button>
    );
  }

  return (
    <div className="gomme">
      <div className="gomme-baslik">
        <b>Listeyi sitene göm</b>
        <button className="gomme-kapat" onClick={() => setAcik(false)} aria-label="Kapat">✕</button>
      </div>

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
        src={src}
        width="100%"
        height={yukseklik}
        style={{ border: "1px solid var(--line)", borderRadius: 10, background: "var(--paper)" }}
        title={`${baslik} önizleme`}
      />

      <textarea className="gomme-kod" readOnly value={kod} rows={3} onFocus={(e) => e.currentTarget.select()} />

      <div className="gomme-alt">
        <button
          className="btn btn-sm btn-primary"
          onClick={() => {
            navigator.clipboard?.writeText(kod);
            setKopyalandi(true);
            setTimeout(() => setKopyalandi(false), 2000);
          }}
        >
          {kopyalandi ? "Kopyalandı ✓" : "Kodu kopyala"}
        </button>
        <a className="btn btn-sm" href={`/api/genel/liste/${slug}`} target="_blank" rel="noopener noreferrer">
          JSON verisi
        </a>
        <span className="dim">Sıralama otomatik güncellenir.</span>
      </div>
    </div>
  );
}
