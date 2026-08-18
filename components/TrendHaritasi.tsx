import Link from "next/link";
import { HARITA, IL_KONUM } from "@/lib/il-konum";

/**
 * Trend haritası — Türkiye'nin nokta haritası.
 *
 * Sınır çizgisi yok: 81 il merkezi coğrafi konumuna yerleştirilince ülke
 * silueti noktaların kendisinden çıkıyor. Böylece dışarıdan harita dosyası
 * taşımadan, yalnızca koordinat verisiyle çiziliyor.
 *
 * Nokta büyüklüğü ve rengi ildeki liste sayısına göre; listesi olan iller
 * kendi şehir sayfasına bağlanıyor, olmayanlar soluk duruyor.
 */

const EN = 760;
const BOY = 340;
const KENAR = 18;

function konum(lon: number, lat: number) {
  const x =
    KENAR + ((lon - HARITA.minLon) / (HARITA.maxLon - HARITA.minLon)) * (EN - KENAR * 2);
  // Enlem yukarı doğru artar, ekran koordinatı aşağı — ters çevriliyor
  const y =
    KENAR + (1 - (lat - HARITA.minLat) / (HARITA.maxLat - HARITA.minLat)) * (BOY - KENAR * 2);
  return { x, y };
}

export default function TrendHaritasi({
  sehirler,
}: {
  /** getSehirler() çıktısı — listesi olan iller */
  sehirler: { sehir: string; slug: string; listeSayisi: number }[];
}) {
  const sayilar = new Map(sehirler.map((s) => [s.sehir, s]));
  const enCok = Math.max(1, ...sehirler.map((s) => s.listeSayisi));

  return (
    <figure className="harita">
      <svg
        viewBox={`0 0 ${EN} ${BOY}`}
        role="img"
        aria-label="Türkiye'de illere göre liste yoğunluğu haritası"
        className="harita-svg"
      >
        {IL_KONUM.map(([il, lon, lat]) => {
          const { x, y } = konum(lon, lat);
          const veri = sayilar.get(il);
          const oran = veri ? veri.listeSayisi / enCok : 0;
          const r = veri ? 4 + oran * 11 : 2.4;
          const etiket = `${il}${veri ? ` — ${veri.listeSayisi} liste` : " — henüz liste yok"}`;

          const nokta = (
            <>
              {veri && (
                <circle className="harita-hale" cx={x} cy={y} r={r + 5} style={{ opacity: 0.12 + oran * 0.2 }} />
              )}
              <circle
                className={veri ? "harita-nokta dolu" : "harita-nokta bos"}
                cx={x}
                cy={y}
                r={r}
                style={veri ? { opacity: 0.55 + oran * 0.45 } : undefined}
              />
              <title>{etiket}</title>
            </>
          );

          return veri ? (
            <Link key={il} href={`/sehir/${veri.slug}`} className="harita-bag">
              {nokta}
            </Link>
          ) : (
            <g key={il}>{nokta}</g>
          );
        })}
      </svg>

      <figcaption className="harita-alt">
        <span className="harita-olcek">
          <span className="harita-nokta-ornek k" /> az
          <span className="harita-nokta-ornek o" />
          <span className="harita-nokta-ornek b" /> çok
        </span>
        <span className="dim">
          {sehirler.length} ilde liste var · noktaya tıklayınca o ilin sayfası açılır
        </span>
      </figcaption>
    </figure>
  );
}
