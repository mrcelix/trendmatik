/**
 * Hata bildirimi.
 *
 * Harici bir SDK'ya bağımlı olmadan iki kanal:
 *  1. Her zaman: tek satırlık JSON log (Vercel Runtime Logs'ta aranabilir olsun diye).
 *  2. HATA_WEBHOOK_URL tanımlıysa: Slack/Discord uyumlu bir webhook'a özet gönderir.
 *
 * Bildirim asla isteği düşürmez; webhook hatası yutulur.
 */

const SON_GONDERIM = new Map<string, number>();
const SUSTURMA_MS = 60_000; // aynı parmak izi dakikada bir kez webhook'a gider

export type HataBaglami = {
  /** Nerede oldu: "sayfa:/liste/[slug]", "eylem:oyVer", "gorev:gundem" */
  nerede: string;
  /** İsteğe bağlı ek alanlar; kişisel veri koymayın */
  ek?: Record<string, string | number | null>;
};

function parmakIzi(mesaj: string, nerede: string): string {
  // Satır/sütun numaraları ve sayılar değişkenlik gösterdiği için sadeleştirilir
  return `${nerede}|${mesaj.replace(/\d+/g, "#").slice(0, 200)}`;
}

function metinlestir(hata: unknown): { mesaj: string; yigin?: string } {
  if (hata instanceof Error) {
    return { mesaj: `${hata.name}: ${hata.message}`, yigin: hata.stack };
  }
  return { mesaj: String(hata) };
}

async function webhookGonder(baslik: string, govde: string) {
  const url = process.env.HATA_WEBHOOK_URL?.trim();
  if (!url) return;
  try {
    // Slack "text" alanını, Discord "content" alanını okur; ikisini de yolluyoruz
    await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `${baslik}\n${govde}`, content: `${baslik}\n${govde}` }),
    });
  } catch {
    // Bildirim kanalı çalışmıyorsa sessizce geç
  }
}

/**
 * Hatayı kaydeder ve (yapılandırılmışsa) webhook'a bildirir.
 * `await` etmek zorunda değilsiniz; hata yolunda beklemeyi engellemez.
 */
export function hataBildir(hata: unknown, baglam: HataBaglami): void {
  const { mesaj, yigin } = metinlestir(hata);
  const kayit = {
    seviye: "error",
    nerede: baglam.nerede,
    mesaj,
    ...baglam.ek,
    yigin: yigin?.split("\n").slice(0, 8).join(" | "),
  };

  // Tek satır JSON: Vercel Runtime Logs'ta metin araması yapılabilir
  console.error(JSON.stringify(kayit));

  const iz = parmakIzi(mesaj, baglam.nerede);
  const simdi = Date.now();
  const son = SON_GONDERIM.get(iz) ?? 0;
  if (simdi - son < SUSTURMA_MS) return;
  SON_GONDERIM.set(iz, simdi);

  const ekSatir = baglam.ek
    ? Object.entries(baglam.ek).map(([k, v]) => `${k}=${v}`).join(" ")
    : "";
  void webhookGonder(
    `🔴 TrendMatik hatası — ${baglam.nerede}`,
    [mesaj, ekSatir, yigin?.split("\n").slice(0, 4).join("\n")].filter(Boolean).join("\n")
  );
}

/**
 * Bir işi çalıştırır; hata olursa bildirip yedek değeri döner.
 * Sayfanın tamamını düşürmemesi gereken yan bölümler için (öneriler, sayaçlar…).
 */
export async function hatayiYut<T>(
  is: () => Promise<T>,
  yedek: T,
  baglam: HataBaglami
): Promise<T> {
  try {
    return await is();
  } catch (e) {
    hataBildir(e, baglam);
    return yedek;
  }
}
