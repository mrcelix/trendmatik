import Link from "next/link";
import type { Reklam, YanListe } from "@/lib/db";
import { gorselGecerliMi } from "@/lib/gorsel";
import YuzenSutun from "@/components/YuzenSutun";

/**
 * Liste sayfasının sağ sütunu.
 *
 * Sunucu bileşeni: veriyi sayfa hazırlıyor, burada yalnızca çizim var.
 * Sıra bilinçli — önce sponsor (görünürlüğü en yüksek yer), sonra alaka
 * derinleşen kutular: benzer → yeni → farklı kategoriden keşif.
 */

function ListeKutusu({
  baslik,
  simge,
  listeler,
  tumuAdres,
  tumuMetin,
}: {
  baslik: string;
  simge: string;
  listeler: YanListe[];
  tumuAdres?: string;
  tumuMetin?: string;
}) {
  if (!listeler.length) return null;

  return (
    <section className="yan-kutu">
      <h3 className="yan-baslik">
        <span aria-hidden="true">{simge}</span> {baslik}
      </h3>
      <ul className="yan-liste">
        {listeler.map((l) => (
          <li key={l.id}>
            <Link href={`/liste/${l.slug}`}>
              <b>{l.title}</b>
              <span className="yan-alt">
                {l.categoryEmoji} {l.categoryName}
                {l.city && ` · ${l.city}`}
                {l.voteCount > 0 && ` · ${l.voteCount} oy`}
              </span>
              {l.ilkMadde && <span className="yan-onizleme">1. {l.ilkMadde}</span>}
            </Link>
          </li>
        ))}
      </ul>
      {tumuAdres && (
        <Link href={tumuAdres} className="yan-tumu">
          {tumuMetin ?? "Tümünü gör"} →
        </Link>
      )}
    </section>
  );
}

/** Sponsor kutusu — kare. Sponsor yoksa kendi çağrımızı gösteriyoruz. */
function SponsorKutusu({ reklam }: { reklam?: Reklam }) {
  if (!reklam) {
    return (
      <section className="yan-kutu sponsor-kutu">
        <span className="sponsor-etiket">Sponsorlu alan</span>
        <div className="sponsor-bos">
          <div className="sponsor-bos-ikon" aria-hidden="true">📣</div>
          <b>Markanız burada</b>
          <p>
            Türkiye&apos;nin trend sıralamalarını takip eden kitleye ulaşın.
            Kare görsel alanı, listeye özel konumlandırma.
          </p>
          <Link href="/oner" className="btn btn-sm">İletişime geç</Link>
        </div>
      </section>
    );
  }

  const gorselVar = reklam.gorsel && gorselGecerliMi(reklam.gorsel);

  return (
    <section className="yan-kutu sponsor-kutu">
      <span className="sponsor-etiket">Sponsorlu</span>
      {/* Tıklama /api/reklam üzerinden geçiyor: sayaç orada artıyor.
          rel=sponsored arama motorlarına ücretli bağlantı olduğunu bildirir. */}
      <a
        href={`/api/reklam/${reklam.id}`}
        target="_blank"
        rel="noopener noreferrer sponsored nofollow"
        className="sponsor-baglanti"
      >
        {gorselVar ? (
          <img
            src={reklam.gorsel}
            alt={reklam.baslik}
            className="sponsor-gorsel"
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="sponsor-gorsel sponsor-yazi" aria-hidden="true">
            {reklam.baslik.slice(0, 2).toLocaleUpperCase("tr")}
          </div>
        )}
        <b className="sponsor-ad">{reklam.baslik}</b>
        {reklam.aciklama && <span className="sponsor-aciklama">{reklam.aciklama}</span>}
      </a>
    </section>
  );
}

export default function ListeYan({
  reklam,
  benzerler,
  yeniler,
  ilginc,
  kategoriSlug,
}: {
  reklam?: Reklam;
  benzerler: YanListe[];
  yeniler: YanListe[];
  ilginc: YanListe[];
  kategoriSlug?: string;
}) {
  return (
    <YuzenSutun className="liste-yan" ariaLabel="İlgili içerikler">
      <SponsorKutusu reklam={reklam} />

      <ListeKutusu
        baslik="Benzer Listeler"
        simge="🔗"
        listeler={benzerler}
        tumuAdres={kategoriSlug ? `/kategori/${kategoriSlug}` : undefined}
        tumuMetin="Kategorinin tamamı"
      />

      <ListeKutusu
        baslik="Yeni Trendler"
        simge="✨"
        listeler={yeniler}
        tumuAdres="/?sekme=yukselen"
        tumuMetin="Yükselenler"
      />

      <ListeKutusu
        baslik="İlgini Çekebilir"
        simge="💡"
        listeler={ilginc}
        tumuAdres="/arsiv"
        tumuMetin="Zirve arşivi"
      />
    </YuzenSutun>
  );
}
