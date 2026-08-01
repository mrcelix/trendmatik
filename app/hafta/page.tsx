import Link from "next/link";
import type { Metadata } from "next";
import { getHaftalikOzet } from "@/lib/db";
import { mutlak, ogTemel } from "@/lib/site";
import ShareButtons from "@/components/ShareButtons";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Bu Hafta TrendMatik'te",
  description:
    "Bu hafta zirvesi değişen listeler, en hızlı yükselen maddeler ve haftanın oylama hareketliliği.",
  alternates: { canonical: mutlak("/hafta") },
  openGraph: {
    ...ogTemel(),
    type: "website",
    title: "Bu Hafta TrendMatik'te",
    description: "Zirve değişimleri, en hızlı yükselenler ve haftanın sayıları.",
    url: mutlak("/hafta"),
    // Haftaya özel kart; her hafta içeriğiyle birlikte değişir
    images: [{ url: mutlak("/api/kart/hafta"), width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Bu Hafta TrendMatik'te",
    images: [mutlak("/api/kart/hafta")],
  },
};

const sayi = (n: number) => n.toLocaleString("tr-TR");

function tarihAraligi(bas: string, bit: string) {
  const b = new Date(`${bas}T12:00:00Z`);
  const s = new Date(`${bit}T12:00:00Z`);
  const bicim = (d: Date) =>
    d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  return `${bicim(b)} – ${bicim(s)}`;
}

export default async function HaftaPage() {
  const o = await getHaftalikOzet();

  return (
    <div className="container">
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> › Bu hafta
      </div>
      <div className="page-head">
        <h1>📅 Bu Hafta TrendMatik&apos;te</h1>
        <span className="sub">{tarihAraligi(o.baslangic, o.bitis)}</span>
      </div>

      <ShareButtons
        url={mutlak("/hafta")}
        title={`Bu hafta TrendMatik'te: ${o.sayilar.oy.toLocaleString("tr-TR")} oy kullanıldı`}
        cardUrl="/api/kart/hafta"
      />

      <div className="admin-kartlar">
        <div className="admin-kart">
          <b className="font-num">{sayi(o.sayilar.oy)}</b>
          <span>Oy kullanıldı</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(o.sayilar.duello)}</b>
          <span>Düello yapıldı</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(o.sayilar.tahmin)}</b>
          <span>Tahmin girildi</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(o.sayilar.yorum)}</b>
          <span>Yorum yazıldı</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(o.sayilar.yeniUye)}</b>
          <span>Yeni üye</span>
        </div>
      </div>

      {!o.veriYeterli && (
        <p className="admin-empty">
          Sıra karşılaştırması için henüz yeterli geçmiş yok. Listeler her gün kaydedildikçe
          bu bölüm dolacak — birkaç gün içinde zirve değişimlerini burada göreceksin.
        </p>
      )}

      {o.zirveDegisenler.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="eyebrow">Taht değişimi</span>
            <h2>👑 Bu hafta zirvesi değişen listeler</h2>
          </div>
          {o.zirveDegisenler.map((z) => (
            <div className="admin-row" key={z.topicSlug}>
              <div className="grow">
                <Link href={`/liste/${z.topicSlug}`}>
                  <b>{z.topicTitle}</b>
                </Link>
                <div className="dim">
                  <span style={{ color: "var(--up)", fontWeight: 700 }}>{z.yeni}</span> zirveye
                  çıktı, <s>{z.eski}</s> tahtı bıraktı
                </div>
              </div>
            </div>
          ))}
        </section>
      )}

      {o.yukselenler.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="eyebrow">Yükselenler</span>
            <h2>🚀 Haftanın en hızlı tırmananları</h2>
          </div>
          <div className="board">
            {o.yukselenler.map((y) => (
              <div className="board-row" key={`${y.topicSlug}-${y.itemId}`}>
                <span className="delta up">▲ {y.fark}</span>
                <div className="row-main">
                  <div className="name">{y.ad}</div>
                  <div className="meta">
                    <Link href={`/liste/${y.topicSlug}#madde-${y.itemId}`}>{y.topicTitle}</Link>
                  </div>
                </div>
                <span className="score-pill font-num">{y.yeniSira}.</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {o.enHareketliListeler.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="eyebrow">Hareketlilik</span>
            <h2>🔥 Bu hafta en çok oylanan listeler</h2>
          </div>
          <div className="topic-grid">
            {o.enHareketliListeler.map((l) => (
              <Link key={l.slug} href={`/liste/${l.slug}`} className="topic-card">
                <h3>{l.title}</h3>
                <div className="stats">
                  <span>🗳️ Bu hafta {sayi(l.oy)} oy</span>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
