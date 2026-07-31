import { ImageResponse } from "next/og";

/**
 * Sitenin varsayılan paylaşım görseli.
 * Kendi görselini tanımlamayan tüm sayfalar (ana sayfa, kategori, arşiv…)
 * bunu kullanır. Liste sayfaları /api/kart/[slug] ile kendi kartını üretir.
 */
export const alt = "TrendMatik — Türkiye'nin Trend Sıralamaları";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "linear-gradient(165deg, #16203a 0%, #1e2b4d 100%)",
          color: "#fff",
          padding: 72,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", fontSize: 46, fontWeight: 800 }}>
          <span>Trend</span>
          <span style={{ color: "#efa013" }}>Matik</span>
        </div>
        <div style={{ display: "flex", fontSize: 68, fontWeight: 800, marginTop: 18, lineHeight: 1.1 }}>
          Türkiye&apos;de ne trend?
        </div>
        <div style={{ display: "flex", fontSize: 30, color: "#b6bedc", marginTop: 18, maxWidth: 900 }}>
          Mekan, hizmet, website, konu, ürün ve haberlerin 10&apos;luk sıralamaları — topluluk oyluyor,
          liste her gün değişiyor.
        </div>
        <div style={{ display: "flex", gap: 14, marginTop: 34 }}>
          {["🗳️ Herkes oy verebilir", "⚡ Üye oyu ×2", "📈 Her gün güncellenir"].map((t) => (
            <div
              key={t}
              style={{
                display: "flex",
                border: "2px solid rgba(255,255,255,0.18)",
                borderRadius: 999,
                padding: "8px 22px",
                fontSize: 24,
                color: "#c7cee8",
              }}
            >
              {t}
            </div>
          ))}
        </div>
      </div>
    ),
    size
  );
}
