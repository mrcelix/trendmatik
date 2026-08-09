// Zaman aralıklı gündem kaynağı — yönetim panelindeki "Gündemi Tara" ekranı kullanır.
//
// Google Trends RSS beslemesi (lib/trends.ts) yalnızca "şu an" gündemini verir,
// geriye dönük pencere desteklemez. Wikipedia görüntülenme ölçümleri gün gün
// alınabildiği için 1/7/15/30 günlük aralıklar burada oradan toplanıyor.
// Ağ hatasında sessizce boş döner; sonuç pencere başına bellekte tutulur.

const API = "https://wikimedia.org/api/rest_v1/metrics/pageviews/top/tr.wikipedia/all-access";
const CACHE_MS = 30 * 60 * 1000;
/** Ölçümler bir gün gecikmeli yayımlanıyor; en yeni tam gün için pay bırakılır. */
const GECIKME_GUN = 2;
/** Aynı anda kaç gün indirilecek — fazlası hız sınırına (429) takılıyor. */
const ES_ZAMANLI = 3;

const bekle = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const PENCERELER = [1, 7, 15, 30] as const;
export type Pencere = (typeof PENCERELER)[number];

export type GundemAdayi = {
  baslik: string;
  /** Pencere boyunca toplam görüntülenme */
  goruntulenme: number;
};

export type GundemKaynakSonuc = {
  adaylar: GundemAdayi[];
  /** Gerçekten indirilen gün sayısı (uzun pencerelerde örnekleme yapılır) */
  okunanGun: number;
  hata: string | null;
};

const g = globalThis as unknown as {
  __tnGundemCache?: Record<number, { at: number; sonuc: GundemKaynakSonuc }>;
};

/**
 * Kaç gün indirileceği. 30 gün için 30 istek atmak yerine eşit aralıklı
 * örnekleme yapılır: sıralama yeterince kararlı, ekran hızlı açılıyor.
 */
function ornekGunler(pencere: Pencere): Date[] {
  const adim = pencere <= 7 ? 1 : pencere <= 15 ? 2 : 3;
  const gunler: Date[] = [];
  for (let i = GECIKME_GUN; i < GECIKME_GUN + pencere; i += adim) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    gunler.push(d);
  }
  return gunler;
}

/** Ansiklopedi iç sayfaları başlık adayı değildir. */
const ELENEN = new Set(["Anasayfa", "Ana_sayfa", "Ana_Sayfa", "-", "Sayfa_bulunamadı"]);

function elenir(makale: string): boolean {
  // ":" içerenler ad alanı sayfaları (Özel:, Kategori:, Vikipedi:, Dosya:…)
  return makale.includes(":") || ELENEN.has(makale) || makale.startsWith("Liste_");
}

async function gunuOku(d: Date): Promise<Map<string, number>> {
  const yil = d.getUTCFullYear();
  const ay = String(d.getUTCMonth() + 1).padStart(2, "0");
  const gun = String(d.getUTCDate()).padStart(2, "0");

  const res = await fetch(`${API}/${yil}/${ay}/${gun}`, {
    signal: AbortSignal.timeout(8000),
    headers: { "User-Agent": "TrendMatik/0.1 (+gundem-tarama)" },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const veri = (await res.json()) as {
    items?: { articles?: { article: string; views: number }[] }[];
  };

  const sayac = new Map<string, number>();
  for (const m of veri.items?.[0]?.articles ?? []) {
    if (elenir(m.article)) continue;
    sayac.set(m.article, Number(m.views) || 0);
  }
  return sayac;
}

/** Verilen penceredeki gündem başlıkları, görüntülenmeye göre sıralı. */
export async function gundemAdaylari(
  pencere: Pencere,
  enFazla = 40
): Promise<GundemKaynakSonuc> {
  const onbellek = (g.__tnGundemCache ??= {});
  const kayit = onbellek[pencere];
  if (kayit && Date.now() - kayit.at < CACHE_MS) return kayit.sonuc;

  const gunler = ornekGunler(pencere);
  const toplam = new Map<string, number>();
  let okunanGun = 0;
  let sonHata: unknown = null;

  // Hepsini birden istemek 429 (hız sınırı) döndürüyor; küçük gruplar hâlinde
  // okunuyor. Tek bir günün düşmesi taramayı bozmaz, o gün toplama katılmaz.
  for (let i = 0; i < gunler.length; i += ES_ZAMANLI) {
    const grup = gunler.slice(i, i + ES_ZAMANLI);
    const sonuclar = await Promise.allSettled(grup.map((d) => gunuOku(d)));
    for (const s of sonuclar) {
      if (s.status === "rejected") {
        sonHata = s.reason;
        continue;
      }
      okunanGun++;
      for (const [makale, n] of s.value) toplam.set(makale, (toplam.get(makale) ?? 0) + n);
    }
    if (i + ES_ZAMANLI < gunler.length) await bekle(200);
  }

  const sonuc: GundemKaynakSonuc =
    okunanGun === 0
      ? {
          adaylar: [],
          okunanGun: 0,
          hata: `Gündem verisine ulaşılamadı (${
            sonHata instanceof Error ? sonHata.message : "hata"
          }).`,
        }
      : {
          adaylar: [...toplam.entries()]
            .map(([makale, n]) => ({ baslik: makale.replace(/_/g, " "), goruntulenme: n }))
            .sort((a, b) => b.goruntulenme - a.goruntulenme)
            .slice(0, enFazla),
          okunanGun,
          hata: null,
        };

  onbellek[pencere] = { at: Date.now(), sonuc };
  return sonuc;
}
