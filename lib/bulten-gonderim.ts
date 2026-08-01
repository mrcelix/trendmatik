import {
  bultenAboneleri, bultenGonderimIsaretle, getHaftalikOzet,
} from "./db";
import { bultenSablonu, epostaAcikMi, epostaGonder } from "./eposta";
import { siteUrl } from "./site";
import { hataBildir } from "./hata";

/**
 * Haftalık bülten gövdesini özetten üretir.
 * Yeterli veri yoksa (yeni kurulum, snapshot geçmişi kısa) null döner —
 * boş bülten göndermeyiz.
 */
export async function bultenIcerigiHazirla(): Promise<{
  baslik: string;
  satirlar: { baslik: string; metin: string; yol: string }[];
} | null> {
  const ozet = await getHaftalikOzet();
  const satirlar: { baslik: string; metin: string; yol: string }[] = [];

  for (const z of ozet.zirveDegisenler.slice(0, 4)) {
    satirlar.push({
      baslik: `👑 ${z.topicTitle}`,
      metin: `Zirve değişti: <b>${z.yeni}</b> birinci sıraya çıktı, ${z.eski} tahtı bıraktı.`,
      yol: `/liste/${z.topicSlug}`,
    });
  }

  for (const y of ozet.yukselenler.slice(0, 4)) {
    satirlar.push({
      baslik: `📈 ${y.ad}`,
      metin: `${y.topicTitle} listesinde ${y.fark} sıra yükselerek ${y.yeniSira}. sıraya geldi.`,
      yol: `/liste/${y.topicSlug}`,
    });
  }

  if (satirlar.length < 3) {
    for (const l of ozet.enHareketliListeler.slice(0, 4)) {
      satirlar.push({
        baslik: `🔥 ${l.title}`,
        metin: `Bu hafta ${l.oy} oy aldı — sıralamayı görmek için listeye göz at.`,
        yol: `/liste/${l.slug}`,
      });
    }
  }

  if (!satirlar.length) return null;

  return {
    baslik: `TrendMatik haftalık özet — ${ozet.baslangic} / ${ozet.bitis}`,
    satirlar: satirlar.slice(0, 8),
  };
}

export type GonderimSonuc = {
  ok: boolean;
  gonderilen: number;
  basarisiz: number;
  hata?: string;
};

/** Onaylı tüm abonelere haftalık bülteni gönderir. */
export async function haftalikBulteniGonder(): Promise<GonderimSonuc> {
  if (!epostaAcikMi()) {
    return { ok: false, gonderilen: 0, basarisiz: 0, hata: "E-posta gönderimi yapılandırılmamış." };
  }

  const icerik = await bultenIcerigiHazirla();
  if (!icerik) {
    return { ok: false, gonderilen: 0, basarisiz: 0, hata: "Bu hafta gönderilecek kadar hareket yok." };
  }

  const aboneler = await bultenAboneleri();
  if (!aboneler.length) {
    return { ok: false, gonderilen: 0, basarisiz: 0, hata: "Onaylı abone yok." };
  }

  const basarili: number[] = [];
  let basarisiz = 0;

  // Sağlayıcı hız sınırına takılmamak için küçük gruplar hâlinde
  for (let i = 0; i < aboneler.length; i += 10) {
    const grup = aboneler.slice(i, i + 10);
    const sonuclar = await Promise.all(
      grup.map(async (a) => {
        try {
          const s = await epostaGonder({
            kime: a.email,
            ...bultenSablonu({
              ...icerik,
              cikisAdresi: `${siteUrl()}/bulten/cik/${a.cikis_token}`,
            }),
          });
          return s.ok ? Number(a.id) : null;
        } catch (e) {
          hataBildir(e, { nerede: "bulten:gonderim" });
          return null;
        }
      })
    );
    for (const r of sonuclar) {
      if (r === null) basarisiz++;
      else basarili.push(r);
    }
  }

  await bultenGonderimIsaretle(basarili);
  return { ok: basarili.length > 0, gonderilen: basarili.length, basarisiz };
}
