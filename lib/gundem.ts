import {
  getCategories, gundemAnahtarlari, gundemEslesmeVerisi, gundemIslendiMi, gundemKaydet,
  gundemMaddesiEkle, createTopicSuggestion, getSetting, setSetting, slugify,
} from "./db";
import { getGoogleTrends } from "./trends";
import { hataBildir } from "./hata";

/**
 * Gündem takibi otomasyonu.
 *
 * Google Trends TR beslemesindeki her başlık için:
 *   1. Zaten bir maddeye karşılık geliyorsa dokunulmaz.
 *   2. Yayındaki bir listeyle örtüşüyorsa o listeye ADAY madde eklenir
 *      (aday maddeler oylanır, yeterli desteği bulursa Top 10'a çıkar).
 *   3. Hiçbiriyle eşleşmiyorsa moderasyon kuyruğuna liste TASLAĞI düşer.
 *
 * Her başlık yalnızca bir kez işlenir; gundem_kayit tablosu tekrarları keser.
 */

/**
 * Tembel tetiklemede iki tarama arasındaki en kısa süre.
 * Zamanlanmış iş günde bir kez çalışıyor (Vercel Hobby planı cron'ları
 * günde bir kezle sınırlıyor); ara zamanlarda yönetici elle tetikleyebilir.
 */
const TARAMA_ARALIGI = 6 * 3600; // saniye
const AYAR_ANAHTARI = "gundem_son_tarama";

/** Türkçe karakterleri sadeleştirip anlamsız kelimeleri atar. */
export function belirtecler(metin: string): string[] {
  const DURAK = new Set([
    "ve", "ile", "de", "da", "bir", "bu", "için", "en", "the", "of", "in",
    "trend", "olan", "nedir", "kim", "kimdir", "ne", "nasıl", "son", "dakika",
  ]);
  return slugify(metin)
    .split("-")
    .filter((k) => k.length >= 3 && !DURAK.has(k));
}

/** İki metnin ortak anlamlı kelime sayısı. */
export function ortakKelime(a: string[], b: string[]): number {
  const kume = new Set(b);
  return a.filter((k) => kume.has(k)).length;
}

/** Bir gündem başlığının sitedeki karşılığı. */
export type Eslesme =
  | { tur: "madde-var" }
  | { tur: "liste-var"; listeId: number; listeBaslik: string; skor: number }
  | { tur: "yeni" };

export type EslesmeSonuc = {
  eslesme: Eslesme;
  /** Otomatik tarama bu başlığı daha önce işlemiş mi (gundem_kayit) */
  islendi: boolean;
};

/**
 * Verilen gündem başlıklarını sitedeki içerikle karşılaştırır.
 * Otomatik taramanın kullandığı eşleştirmenin aynısı — "Gündemi Tara"
 * ekranındaki sonuç ile taramanın davranışı ayrışmasın diye ortak.
 */
export async function adaylariEslestir(basliklar: string[]): Promise<EslesmeSonuc[]> {
  const [{ listeler, maddeAdlari }, islenmis] = await Promise.all([
    gundemEslesmeVerisi(),
    gundemAnahtarlari(),
  ]);

  const listeBelirtecleri = listeler.map((l) => ({
    liste: l,
    kelimeler: belirtecler(`${l.title} ${l.description} ${l.city ?? ""}`),
  }));

  return basliklar.map((baslik) => {
    const islendi = islenmis.has(slugify(baslik).slice(0, 120));

    if (maddeAdlari.has(baslik.toLocaleLowerCase("tr"))) {
      return { eslesme: { tur: "madde-var" }, islendi };
    }

    const kelimeler = belirtecler(baslik);
    let enIyi: { id: number; title: string; skor: number } | null = null;
    for (const { liste, kelimeler: lk } of listeBelirtecleri) {
      const skor = ortakKelime(kelimeler, lk);
      if (skor >= 2 && (!enIyi || skor > enIyi.skor)) {
        enIyi = { id: liste.id, title: liste.title, skor };
      }
    }

    if (enIyi) {
      return {
        eslesme: { tur: "liste-var", listeId: enIyi.id, listeBaslik: enIyi.title, skor: enIyi.skor },
        islendi,
      };
    }
    return { eslesme: { tur: "yeni" }, islendi };
  });
}

export type TaramaSonuc = {
  calisti: boolean;
  /** Atlandıysa sebebi */
  sebep?: string;
  incelenen: number;
  maddeEklendi: number;
  taslakAcildi: number;
  atlanan: number;
  hata?: string;
};

const BOS: TaramaSonuc = {
  calisti: false, incelenen: 0, maddeEklendi: 0, taslakAcildi: 0, atlanan: 0,
};

/**
 * Taramayı çalıştırır.
 * `zorla` verilmezse son taramadan bu yana TARAMA_ARALIGI geçmediyse atlar —
 * böylece sayfa açılışlarına bağlı tembel tetikleme güvenli olur.
 */
export async function gundemTaramasi(zorla = false): Promise<TaramaSonuc> {
  const simdi = Math.floor(Date.now() / 1000);

  if (!zorla) {
    const son = Number((await getSetting(AYAR_ANAHTARI)) ?? 0);
    if (son && simdi - son < TARAMA_ARALIGI) {
      return { ...BOS, sebep: "Son tarama üzerinden yeterli süre geçmedi." };
    }
  }
  // Eşzamanlı örneklerin aynı anda taramasını engellemek için önce işaretle
  await setSetting(AYAR_ANAHTARI, String(simdi));

  const { items, error } = await getGoogleTrends();
  if (error) return { ...BOS, calisti: true, hata: error };
  if (!items.length) return { ...BOS, calisti: true, sebep: "Beslemede başlık yok." };

  const sonuc: TaramaSonuc = { ...BOS, calisti: true };

  try {
    const { listeler, maddeAdlari } = await gundemEslesmeVerisi();
    const kategoriler = await getCategories();
    // Eşleşmeyen gündem başlıkları "Konu" kategorisine düşer
    const konuKategori =
      kategoriler.find((k) => k.slug === "konu") ?? kategoriler[0];

    const listeBelirtecleri = listeler.map((l) => ({
      liste: l,
      kelimeler: belirtecler(`${l.title} ${l.description} ${l.city ?? ""}`),
    }));

    for (const aday of items) {
      sonuc.incelenen++;
      const anahtar = slugify(aday.title).slice(0, 120);
      if (!anahtar || (await gundemIslendiMi(anahtar))) {
        sonuc.atlanan++;
        continue;
      }

      // 1. Zaten madde olarak var mı?
      if (maddeAdlari.has(aday.title.toLocaleLowerCase("tr"))) {
        await gundemKaydet(anahtar, aday.title, "zaten-var");
        sonuc.atlanan++;
        continue;
      }

      // 2. Yayındaki bir listeyle örtüşüyor mu?
      const kelimeler = belirtecler(aday.title);
      let enIyi: { id: number; title: string; skor: number } | null = null;
      for (const { liste, kelimeler: lk } of listeBelirtecleri) {
        const skor = ortakKelime(kelimeler, lk);
        if (skor >= 2 && (!enIyi || skor > enIyi.skor)) {
          enIyi = { id: liste.id, title: liste.title, skor };
        }
      }

      if (enIyi) {
        await gundemMaddesiEkle(enIyi.id, aday.title.slice(0, 80));
        await gundemKaydet(anahtar, aday.title, "madde-eklendi", enIyi.title);
        maddeAdlari.add(aday.title.toLocaleLowerCase("tr"));
        sonuc.maddeEklendi++;
        continue;
      }

      // 3. Yeni liste taslağı — moderasyon kuyruğuna düşer, yayına çıkmaz
      if (konuKategori) {
        const { slug } = await createTopicSuggestion({
          title: `${aday.title} — trend olanlar`,
          description:
            `Gündemden otomatik oluşturuldu${aday.traffic ? ` (${aday.traffic} arama)` : ""}. ` +
            "Yayına almadan önce başlığı düzenleyin ve maddeleri girin.",
          categoryId: konuKategori.id,
          city: null,
          userId: null, // sahipsiz taslak: kullanıcı önerisi değil
          itemNames: [],
          status: "pending",
        });
        await gundemKaydet(anahtar, aday.title, "taslak-acildi", slug);
        sonuc.taslakAcildi++;
      }
    }
  } catch (e) {
    hataBildir(e, { nerede: "gorev:gundem-taramasi" });
    return { ...sonuc, hata: "Tarama sırasında hata oluştu." };
  }

  return sonuc;
}
