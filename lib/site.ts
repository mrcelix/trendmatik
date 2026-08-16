/**
 * Sitenin mutlak adresi. Mutlak URL gereken yerlerde kullanılır:
 * sitemap, robots, JSON-LD ve OG görselleri (göreli yol OG'de çalışmaz).
 *
 * Öncelik: NEXT_PUBLIC_SITE_URL (özel alan adı) → Vercel üretim adresi →
 * Vercel önizleme adresi → yerel geliştirme.
 */
export function siteUrl(): string {
  const acik = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (acik) return acik.replace(/\/+$/, "");

  const uretim = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (uretim) return `https://${uretim}`;

  const onizleme = process.env.VERCEL_URL;
  if (onizleme) return `https://${onizleme}`;

  return "http://localhost:3000";
}

/** Göreli yolu mutlak adrese çevirir. */
export function mutlak(yol: string): string {
  return `${siteUrl()}${yol.startsWith("/") ? yol : `/${yol}`}`;
}

/**
 * Sayfa metadata'sındaki openGraph nesnesi kök layout'takini tamamen ezer;
 * siteName ve locale her sayfada yeniden verilmeli. Bu yardımcı onları taşır.
 *
 * Site adı yönetim panelinden değiştirilebildiği için ayarlardan okunur —
 * sabit yazıldığında ad değiştirilse bile paylaşım kartlarında eskisi kalıyordu.
 */
export async function ogTemel() {
  const { getSettings } = await import("./db");
  const ayarlar = await getSettings();
  return {
    siteName: ayarlar.site_adi?.trim() || "TrendMatik",
    locale: "tr_TR" as const,
    // Sayfa openGraph tanımlayınca dosya tabanlı varsayılan görsel de düşüyor
    images: [{ url: mutlak("/opengraph-image"), width: 1200, height: 630 }],
  };
}
