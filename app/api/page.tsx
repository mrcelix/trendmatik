import Link from "next/link";
import { siteUrl } from "@/lib/site";
import { ogTemel } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Açık API ve gömme",
  description:
    "TrendMatik listelerini JSON olarak çekin ya da kendi sitenize gömün. Kimlik doğrulaması gerekmez.",
  openGraph: { ...ogTemel(), title: "TrendMatik Açık API", url: `${siteUrl()}/api` },
};

function Uc({
  yol,
  aciklama,
  ornek,
}: {
  yol: string;
  aciklama: string;
  ornek: string;
}) {
  return (
    <div className="api-uc">
      <code className="api-yol">GET {yol}</code>
      <p>{aciklama}</p>
      <pre className="api-ornek">{ornek}</pre>
    </div>
  );
}

export default function ApiPage() {
  const kok = siteUrl();

  return (
    <div className="container">
      <div className="page-head">
        <h1>🔌 Açık API ve gömme</h1>
        <span className="sub">Kimlik doğrulaması yok · CORS açık · 5 dakika önbellek</span>
      </div>

      <div className="api-govde">
        <p>
          TrendMatik sıralamaları herkese açıktır. Aşağıdaki uçlardan JSON olarak
          çekebilir ya da listeleri kendi sitenize gömebilirsiniz. Tek ricamız
          kaynak olarak TrendMatik&apos;e bağlantı vermeniz.
        </p>

        <h2>Uçlar</h2>

        <Uc
          yol="/api/genel/listeler"
          aciklama="Yayındaki tüm listelerin dizini: slug, başlık, kategori, şehir ve her liste için veri/gömme adresleri."
          ornek={`curl ${kok}/api/genel/listeler`}
        />

        <Uc
          yol="/api/genel/liste/{slug}"
          aciklama="Tek bir listenin güncel sıralaması: sıra, ad, puan, oy sayısı, günlük değişim, görsel ve site adresi."
          ornek={`curl ${kok}/api/genel/liste/istanbul-da-trend-kahve-mekanlari`}
        />

        <h2>Gömme</h2>
        <p>
          Her listenin sayfasında <b>&quot;Bu listeyi sitene göm&quot;</b> düğmesi
          hazır kodu üretir. Elle yazmak isterseniz:
        </p>
        <pre className="api-ornek">{`<iframe
  src="${kok}/gomulu/liste-slug?adet=5&tema=gece"
  width="100%" height="290" style="border:0" loading="lazy"
  title="TrendMatik listesi"></iframe>`}</pre>
        <p className="form-note" style={{ marginTop: 0 }}>
          <code>adet</code>: 3–10 arası madde sayısı (varsayılan 10) ·{" "}
          <code>tema</code>: <code>gece</code> verilirse koyu görünüm.
          Gömülü liste sıralama değiştikçe kendiliğinden güncellenir.
        </p>

        <h2>Sınırlar</h2>
        <ul className="api-liste">
          <li>Yanıtlar 5 dakika kenar önbelleğinde tutulur; daha sık çekmek yeni veri getirmez.</li>
          <li>Yalnızca <b>onaylanmış</b> listeler ve <b>yayındaki</b> maddeler döner.</li>
          <li>Yazma ucu yoktur — oy vermek için site üzerinden gelin.</li>
        </ul>

        <p className="form-note">
          Bir sorun mu var, farklı bir uca mı ihtiyacınız var?{" "}
          <Link href="/oner">Bize yazın</Link>.
        </p>
      </div>
    </div>
  );
}
