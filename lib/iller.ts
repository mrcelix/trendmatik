/**
 * Türkiye'nin 81 ili (plaka sırası).
 *
 * Şehir seçicide kullanılır. Listeler `topics.city` alanında il adını
 * saklıyor; buradaki yazımlar o alanla birebir eşleşmeli.
 */
export const ILLER = [
  "Adana", "Adıyaman", "Afyonkarahisar", "Ağrı", "Amasya", "Ankara", "Antalya",
  "Artvin", "Aydın", "Balıkesir", "Bilecik", "Bingöl", "Bitlis", "Bolu",
  "Burdur", "Bursa", "Çanakkale", "Çankırı", "Çorum", "Denizli", "Diyarbakır",
  "Edirne", "Elazığ", "Erzincan", "Erzurum", "Eskişehir", "Gaziantep", "Giresun",
  "Gümüşhane", "Hakkâri", "Hatay", "Isparta", "Mersin", "İstanbul", "İzmir",
  "Kars", "Kastamonu", "Kayseri", "Kırklareli", "Kırşehir", "Kocaeli", "Konya",
  "Kütahya", "Malatya", "Manisa", "Kahramanmaraş", "Mardin", "Muğla", "Muş",
  "Nevşehir", "Niğde", "Ordu", "Rize", "Sakarya", "Samsun", "Siirt", "Sinop",
  "Sivas", "Tekirdağ", "Tokat", "Trabzon", "Tunceli", "Şanlıurfa", "Uşak",
  "Van", "Yozgat", "Zonguldak", "Aksaray", "Bayburt", "Karaman", "Kırıkkale",
  "Batman", "Şırnak", "Bartın", "Ardahan", "Iğdır", "Yalova", "Karabük",
  "Kilis", "Osmaniye", "Düzce",
] as const;

/** Seçicide alfabetik görünsün (Türkçe sıralamayla). */
export const ILLER_ALFABETIK = [...ILLER].sort((a, b) => a.localeCompare(b, "tr"));

export const TUM_TURKIYE = "Türkiye geneli";

/**
 * URL'de kullanılacak il anahtarı.
 *
 * lib/db.ts içindeki slugify() ile BİREBİR aynı kuralı uygular; oradan
 * import edilemiyor çünkü db.ts veritabanı sürücülerini yüklüyor ve bu
 * dosya istemci bileşenlerinden (IlSecici) kullanılıyor. Biri değişirse
 * diğeri de değişmeli.
 */
export function ilSlug(il: string): string {
  const harf: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u",
    â: "a", Â: "a", î: "i", Î: "i", û: "u", Û: "u",
  };
  return il
    .replace(/[çğıöşüÇĞİIÖŞÜâÂîÎûÛ]/g, (c) => harf[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}
