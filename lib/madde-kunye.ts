/**
 * Madde künyesi — liste satırında üzerine gelince açılan detay kartı.
 *
 * Hangi alanın gösterileceğine maddenin bağlı olduğu listenin kategorisi
 * karar verir: bir mekan için adres ve harita anlamlı, bir ürün için fiyat.
 * Boş alanlar hiç çizilmez; künyesi tamamen boş olan maddede kart açılmaz.
 */

export type KunyeAlani = "harita" | "adres" | "telefon" | "site" | "fiyat";

/** Kategori slug'ına göre gösterilecek alanlar ve sıraları. */
export const MADDE_ALANLARI: Record<string, KunyeAlani[]> = {
  mekan: ["harita", "adres", "telefon", "site"],
  hizmet: ["telefon", "site", "adres"],
  urun: ["fiyat", "site"],
  website: ["site"],
  konu: ["site"],
  haber: ["site"],
};

/** Tanımsız kategoriler için makul varsayılan. */
export const VARSAYILAN_ALANLAR: KunyeAlani[] = ["site"];

export function kategoriAlanlari(kategoriSlug?: string): KunyeAlani[] {
  return (kategoriSlug && MADDE_ALANLARI[kategoriSlug]) || VARSAYILAN_ALANLAR;
}

export type Kunye = {
  adres?: string;
  telefon?: string;
  harita?: string;
  site?: string;
  fiyat?: string;
};

/**
 * Harita bağlantısı.
 *
 * Elle girilmiş bir adres varsa o kullanılır. Yoksa ad ve şehirden bir
 * Google Haritalar ARAMA adresi türetilir — bu bir konum iddiası değil,
 * arama sorgusudur; yanlış koordinat göstermek yerine kullanıcıyı doğru
 * arama sonucuna götürür.
 */
export function haritaAdresi(kunye: Kunye, ad: string, sehir?: string | null): string {
  if (kunye.harita) return kunye.harita;
  const sorgu = [ad, sehir].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(sorgu)}`;
}

/** Telefonu tel: bağlantısına çevirir (boşluk ve ayraçlar temizlenir). */
export function telefonAdresi(telefon: string): string {
  return `tel:${telefon.replace(/[^\d+]/g, "")}`;
}

/**
 * Kartta gösterilecek satırlar. Sırayı kategori belirler; harita mekan
 * kategorisinde her zaman var (türetilebildiği için).
 */
export function kunyeSatirlari(
  kunye: Kunye,
  opts: { ad: string; sehir?: string | null; kategoriSlug?: string }
): { alan: KunyeAlani; simge: string; etiket: string; deger: string; adres?: string }[] {
  const alanlar = kategoriAlanlari(opts.kategoriSlug);
  const satirlar: { alan: KunyeAlani; simge: string; etiket: string; deger: string; adres?: string }[] = [];

  for (const alan of alanlar) {
    if (alan === "harita") {
      // Mekan kategorisinde şehir ya da elle girilmiş harita varsa göster
      if (!kunye.harita && !opts.sehir) continue;
      satirlar.push({
        alan, simge: "📍", etiket: "Haritada aç",
        deger: opts.sehir ?? "Konum",
        adres: haritaAdresi(kunye, opts.ad, opts.sehir),
      });
    } else if (alan === "adres" && kunye.adres) {
      satirlar.push({ alan, simge: "🏠", etiket: "Adres", deger: kunye.adres });
    } else if (alan === "telefon" && kunye.telefon) {
      satirlar.push({
        alan, simge: "📞", etiket: "Telefon",
        deger: kunye.telefon, adres: telefonAdresi(kunye.telefon),
      });
    } else if (alan === "site" && kunye.site) {
      let gosterim = kunye.site;
      try { gosterim = new URL(kunye.site).hostname.replace(/^www\./, ""); } catch { /* ham bırak */ }
      satirlar.push({ alan, simge: "🌐", etiket: "Web sitesi", deger: gosterim, adres: kunye.site });
    } else if (alan === "fiyat" && kunye.fiyat) {
      satirlar.push({ alan, simge: "🏷️", etiket: "Fiyat", deger: kunye.fiyat });
    }
  }

  return satirlar;
}
