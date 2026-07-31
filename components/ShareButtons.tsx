"use client";

import { useState } from "react";

/**
 * Paylaşım düğmeleri. Mobilde cihazın kendi paylaşım penceresini kullanır
 * (Web Share API), masaüstünde WhatsApp / X / bağlantı kopyala sunar.
 */
export default function ShareButtons({
  url,
  title,
  cardUrl,
}: {
  url: string;
  title: string;
  cardUrl: string;
}) {
  const [kopyalandi, setKopyalandi] = useState(false);
  const metin = `${title} — TrendMatik`;

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
    } catch {
      /* kullanıcı vazgeçti */
    }
  }

  const paylasimVar = typeof navigator !== "undefined" && !!navigator.share;

  return (
    <div className="share">
      <span className="share-label">Paylaş:</span>

      <a
        className="share-btn wa"
        href={`https://wa.me/?text=${encodeURIComponent(`${metin} ${url}`)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="WhatsApp'ta paylaş"
      >
        WhatsApp
      </a>

      <a
        className="share-btn x"
        href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(metin)}&url=${encodeURIComponent(url)}`}
        target="_blank"
        rel="noopener noreferrer"
        title="X'te paylaş"
      >
        X
      </a>

      <button className="share-btn" onClick={kopyala} title="Bağlantıyı kopyala">
        {kopyalandi ? "✓ Kopyalandı" : "🔗 Bağlantı"}
      </button>

      <a className="share-btn" href={cardUrl} target="_blank" rel="noopener noreferrer" title="Paylaşım görselini indir">
        🖼️ Görsel
      </a>

      {paylasimVar && (
        <button className="share-btn" onClick={cihazlaPaylas} title="Diğer uygulamalar">
          ⋯ Diğer
        </button>
      )}
    </div>
  );
}
