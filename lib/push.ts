import { pushAboneSil, type PushAbone } from "./db";
import { hataBildir } from "./hata";

/**
 * Web push gönderimi.
 *
 * VAPID anahtarları tanımlı değilse özellik tamamen kapalıdır: arayüzde
 * düğme çıkmaz, uçlar 404 döner. Anahtar üretmek için:
 *   npx web-push generate-vapid-keys
 */

export function pushAcikMi(): boolean {
  return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
}

export function pushAcikAnahtar(): string {
  return process.env.VAPID_PUBLIC_KEY ?? "";
}

/** web-push yalnızca gerektiğinde yüklenir (sunucusuz soğuk başlangıç). */
async function kutuphane() {
  const mod = await import("web-push");
  const webpush = (mod as unknown as { default?: typeof import("web-push") }).default ?? mod;
  webpush.setVapidDetails(
    process.env.VAPID_KONU?.trim() || "mailto:iletisim@trendmatik.com",
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );
  return webpush;
}

export type PushIcerik = {
  baslik: string;
  govde: string;
  yol?: string;
  /** Aynı etiketli bildirimler üst üste yığılmaz */
  etiket?: string;
};

/**
 * Verilen aboneliklere bildirim gönderir.
 * 404/410 dönen abonelikler silinir — tarayıcı aboneliği iptal etmiştir.
 */
export async function pushGonder(
  aboneler: PushAbone[],
  icerik: PushIcerik
): Promise<{ gonderilen: number; temizlenen: number }> {
  if (!pushAcikMi() || !aboneler.length) return { gonderilen: 0, temizlenen: 0 };

  const webpush = await kutuphane();
  const govde = JSON.stringify(icerik);
  let gonderilen = 0;
  let temizlenen = 0;

  await Promise.all(
    aboneler.map(async (a) => {
      try {
        await webpush.sendNotification(
          { endpoint: a.endpoint, keys: { p256dh: a.p256dh, auth: a.auth } },
          govde
        );
        gonderilen++;
      } catch (e) {
        const durum = (e as { statusCode?: number }).statusCode;
        if (durum === 404 || durum === 410) {
          await pushAboneSil(a.endpoint);
          temizlenen++;
        } else {
          hataBildir(e, { nerede: "push:gonderim", ek: { durum: durum ?? null } });
        }
      }
    })
  );

  return { gonderilen, temizlenen };
}
