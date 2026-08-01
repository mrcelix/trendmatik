import { hataBildir } from "./hata";

/**
 * Görsel adresleri.
 *
 * Görseller kendi sunucumuzda tutulmaz; yönetici bir adres yapıştırır ya da
 * maddenin web sitesinden og:image çekilir. Bu yüzden adresin güvenli
 * olduğunu her kullanımda doğrulamak gerekiyor.
 */

/** Yalnızca https ve makul uzunlukta adresler kabul edilir. */
export function gorselGecerliMi(adres: string): boolean {
  if (!adres) return false;
  try {
    const u = new URL(adres);
    if (u.protocol !== "https:") return false;
    if (adres.length > 500) return false;
    // Yerel ağ adresleri: sunucu tarafında istek atılmayacak olsa da
    // tarayıcıya da verilmemeli
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h.endsWith(".local") || /^\d+\.\d+\.\d+\.\d+$/.test(h)) return false;
    return true;
  } catch {
    return false;
  }
}

export function gorselTemizle(adres: string): string {
  const t = adres.trim();
  return gorselGecerliMi(t) ? t : "";
}

/**
 * Harf avatarı: görseli olmayan maddeler için tutarlı renkte yer tutucu.
 * Renk addan türetilir, böylece aynı madde her yerde aynı renkte görünür.
 */
const PALET = [
  "#3a45e0", "#0f9d8f", "#e0494e", "#efa013", "#7c3aed",
  "#0ea5e9", "#15a24a", "#db2777", "#f97316", "#475569",
];

export function avatarRengi(ad: string): string {
  let h = 0;
  for (let i = 0; i < ad.length; i++) h = (h * 31 + ad.charCodeAt(i)) >>> 0;
  return PALET[h % PALET.length];
}

export function avatarHarfleri(ad: string): string {
  const kelimeler = ad.trim().split(/\s+/).filter(Boolean);
  if (!kelimeler.length) return "?";
  if (kelimeler.length === 1) return kelimeler[0].slice(0, 2).toLocaleUpperCase("tr");
  return (kelimeler[0][0] + kelimeler[1][0]).toLocaleUpperCase("tr");
}

// ---- og:image çekme -----------------------------------------------------------

const OG_KALIPLARI = [
  /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
  /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
  /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
];

/**
 * Verilen sayfadan og:image adresini çeker.
 * Yalnızca yönetim panelinden, yöneticinin girdiği adresle çağrılır —
 * rastgele kullanıcı girdisiyle çağrılmamalıdır (SSRF).
 */
export async function ogGorselCek(sayfaAdresi: string): Promise<string> {
  if (!gorselGecerliMi(sayfaAdresi)) return "";

  try {
    const kontrol = new AbortController();
    const zamanlayici = setTimeout(() => kontrol.abort(), 6000);
    const cevap = await fetch(sayfaAdresi, {
      signal: kontrol.signal,
      redirect: "follow",
      headers: { "User-Agent": "TrendMatikBot/1.0 (+https://trendmatik.com)" },
    });
    clearTimeout(zamanlayici);
    if (!cevap.ok) return "";

    // Tüm sayfayı okumaya gerek yok; og etiketleri <head> içinde
    const html = (await cevap.text()).slice(0, 120_000);
    for (const kalip of OG_KALIPLARI) {
      const eslesme = html.match(kalip);
      if (eslesme?.[1]) {
        const mutlak = new URL(eslesme[1], sayfaAdresi).toString();
        if (gorselGecerliMi(mutlak)) return mutlak;
      }
    }
    return "";
  } catch (e) {
    hataBildir(e, { nerede: "gorsel:og-cek", ek: { adres: sayfaAdresi.slice(0, 120) } });
    return "";
  }
}
