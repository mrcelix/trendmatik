import { oneriKaydet, taramaIsaretle, taranmamisMaddeler } from "./db";
import { hataBildir } from "./hata";

/**
 * Künye tarayıcısı.
 *
 * Madde adından aday alan adları üretir, HER BİRİNE CANLI İSTEK ATAR ve
 * yalnızca gerçekten yanıt veren + sayfa başlığı marka adını içeren
 * adresleri ÖNERİ olarak kaydeder. Öneriler maddeye yazılmaz; yönetici
 * /admin/kunye ekranından onaylayana kadar bekler.
 *
 * Uydurma veri üretilmez: doğrulanamayan hiçbir şey öneriye dönüşmez.
 */

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

/** Marka adını alan adı parçasına çevirir. */
function alanParcasi(ad: string): string {
  const harf: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u",
    Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return ad
    .replace(/[çğıöşüÇĞİIÖŞÜâîû]/g, (c) => harf[c] ?? c)
    .toLowerCase()
    .replace(/&/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

/**
 * Aday adresler. Yalnızca marka gibi görünen adlar için üretilir:
 * "Aralıklı oruç" ya da "Kaygı bozukluğu" gibi kavramların resmî sitesi
 * olmaz, bunlara istek atmak boşuna yük.
 */
function adaylar(ad: string): string[] {
  const temiz = ad.trim();
  // Çok uzun ya da cümle gibi olan adlar marka değildir
  const kelime = temiz.split(/\s+/).length;
  if (kelime > 4 || temiz.length > 34) return [];
  // Yalnızca ilk harfi büyük olmayan, tamamen küçük yazılmış kavramlar elenir
  if (!/[A-ZÇĞİÖŞÜ0-9]/.test(temiz[0] ?? "")) return [];

  const parca = alanParcasi(temiz);
  if (parca.length < 3) return [];

  // İki aday yeterli: "www.x.com" zaten "x.com"a yönleniyor ve her ek
  // aday tarama süresini uzatıp sunucusuz zaman sınırına yaklaştırıyor.
  return [`https://www.${parca}.com.tr`, `https://www.${parca}.com`];
}

/**
 * Alan adı pazarları ve park servisleri.
 * "Ministry of Coffee" taramasında ministryofcoffee.com hugedomains.com'a
 * düşüp "MinistryOfCoffee.com is for sale" başlığıyla geldiği ve başlık
 * marka adını içerdiği için yanlış pozitif üretmişti.
 */
const PARK_SERVISLERI = [
  "hugedomains.com", "sedo.com", "afternic.com", "dan.com", "undeveloped.com",
  "bodis.com", "parkingcrew.net", "above.com", "squadhelp.com", "atom.com",
  "domainmarket.com", "buydomains.com", "sav.com", "namecheap.com",
];

const SATILIK_KALIPLARI =
  /\b(is for sale|for sale|domain for sale|buy this domain|satılık|parked domain|this domain|zu verkaufen)\b/i;

/** Adres bir park/satış sayfasına mı düşmüş? */
function parkSayfasiMi(sonHost: string, baslik: string): boolean {
  if (PARK_SERVISLERI.some((p) => sonHost === p || sonHost.endsWith("." + p))) return true;
  return SATILIK_KALIPLARI.test(baslik);
}

/** Sayfa başlığı marka adını içeriyor mu — güven puanının çekirdeği. */
function baslikPuani(html: string, ad: string): { puan: number; baslik: string } {
  const eslesme = html.match(/<title[^>]*>([\s\S]{0,200}?)<\/title>/i);
  const baslik = (eslesme?.[1] ?? "").replace(/\s+/g, " ").trim().slice(0, 90);
  if (!baslik) return { puan: 0, baslik: "" };

  const norm = (s: string) => alanParcasi(s);
  const b = norm(baslik);
  const a = norm(ad);
  if (!a) return { puan: 0, baslik };

  if (b.includes(a)) return { puan: 45, baslik };
  // Ad birden çok kelimeyse en uzun kelimesi başlıkta geçiyor mu
  const enUzun = ad.split(/\s+/).sort((x, y) => y.length - x.length)[0] ?? "";
  if (enUzun.length >= 5 && b.includes(norm(enUzun))) return { puan: 22, baslik };
  return { puan: 0, baslik };
}

type Bulgu = { adres: string; guven: number; kanit: string };

async function adayiDene(adres: string, ad: string): Promise<Bulgu | null> {
  try {
    const kontrol = new AbortController();
    const zaman = setTimeout(() => kontrol.abort(), 5000);
    const cevap = await fetch(adres, {
      redirect: "follow",
      signal: kontrol.signal,
      headers: { "User-Agent": UA, "Accept-Language": "tr-TR,tr;q=0.9" },
    });
    clearTimeout(zaman);

    if (!cevap.ok) return null;

    const sonHost = new URL(cevap.url).hostname.replace(/^www\./, "");
    const html = (await cevap.text()).slice(0, 60_000);
    const { puan, baslik } = baslikPuani(html, ad);

    // Başlık markayı doğrulamıyorsa öneri üretilmez: alan adının açılması
    // tek başına o markaya ait olduğunu göstermez.
    if (puan === 0) return null;
    // Satılık/park edilmiş alan adları elenir
    if (parkSayfasiMi(sonHost, baslik)) return null;

    // Başka bir alan adına yönlendiyse güven düşürülür: doğru olabilir
    // (marka birden çok alan adı tutuyor olabilir) ama gözle bakılmalı.
    const istenenHost = new URL(adres).hostname.replace(/^www\./, "");
    const yonlendi = sonHost !== istenenHost;
    const guven = Math.min(95, 45 + puan - (yonlendi ? 15 : 0));

    return {
      adres: cevap.url.replace(/\/$/, ""),
      guven,
      kanit:
        `HTTP ${cevap.status} · ${sonHost}${yonlendi ? ` (${istenenHost}'dan yönlendi)` : ""}` +
        ` · başlık: "${baslik}"`,
    };
  } catch {
    return null;
  }
}

export type TaramaSonuc = {
  incelenen: number;
  oneri: number;
  adaysiz: number;
  bulunamayan: number;
};

/**
 * Bir partiyi tarar. Sunucusuz süre sınırına takılmamak için küçük
 * partiler hâlinde çalıştırılır; her çağrı kaldığı yerden devam eder.
 */
export async function kunyeTara(partiBoyu = 20): Promise<TaramaSonuc> {
  const maddeler = await taranmamisMaddeler(partiBoyu);
  const sonuc: TaramaSonuc = { incelenen: 0, oneri: 0, adaysiz: 0, bulunamayan: 0 };

  // Aynı anda 8 istek. Parti 20, aday 2, zaman aşımı 5 sn → en kötü durumda
  // ~25 sn; Vercel'in 60 sn sınırının içinde kalıyor.
  const KUYRUK = 8;
  for (let i = 0; i < maddeler.length; i += KUYRUK) {
    const dilim = maddeler.slice(i, i + KUYRUK);
    await Promise.all(
      dilim.map(async (m) => {
        sonuc.incelenen++;
        try {
          const liste = adaylar(m.name);
          if (!liste.length) {
            await taramaIsaretle(m.id, "aday-yok");
            sonuc.adaysiz++;
            return;
          }

          for (const aday of liste) {
            const bulgu = await adayiDene(aday, m.name);
            if (bulgu) {
              await oneriKaydet({
                itemId: m.id, alan: "site",
                deger: bulgu.adres, kanit: bulgu.kanit, guven: bulgu.guven,
              });
              await taramaIsaretle(m.id, "oneri");
              sonuc.oneri++;
              return;
            }
          }
          await taramaIsaretle(m.id, "bulunamadi");
          sonuc.bulunamayan++;
        } catch (e) {
          hataBildir(e, { nerede: "gorev:kunye-tarama", ek: { itemId: m.id } });
          await taramaIsaretle(m.id, "hata");
        }
      })
    );
  }

  return sonuc;
}
