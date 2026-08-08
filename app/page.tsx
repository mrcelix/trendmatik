import Link from "next/link";
import {
  getCategories, getHeroData, getHeroKategoriLimit, getTopicSummaries, type TopicSummary,
} from "@/lib/db";
import { mutlak, siteUrl } from "@/lib/site";
import HeroFinder from "@/components/HeroFinder";

export const dynamic = "force-dynamic";

function TopicCard({ t, hot }: { t: TopicSummary; hot: boolean }) {
  return (
    <Link href={`/liste/${t.slug}`} className="topic-card">
      <div className="cat-line">
        <span>{t.categoryEmoji} {t.categoryName}</span>
        {t.city && <span className="city-tag">{t.city}</span>}
        {hot && <span className="badge-hot">🔥 Yükseliyor</span>}
      </div>
      <h3>{t.title}</h3>
      <div className="preview">
        {t.topItems.slice(0, 3).map((n, i) => `${i + 1}. ${n}`).join(" · ")}…
      </div>
      <div className="stats">
        <span>🗳️ {t.voteCount} oy</span>
        <span>⭐ {Math.round(t.popScore)} puan</span>
      </div>
    </Link>
  );
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ sekme?: string }>;
}) {
  const { sekme } = await searchParams;
  const rising = sekme !== "populer";
  const [topics, hero, categories, heroKategoriLimit] = await Promise.all([
    getTopicSummaries(),
    getHeroData(),
    getCategories(),
    getHeroKategoriLimit(),
  ]);
  const VITRIN_LIMIT = 36;

  const sorted = [...topics].sort((a, b) =>
    rising ? b.trendScore - a.trendScore : b.popScore - a.popScore
  );
  const gosterilen = sorted.slice(0, VITRIN_LIMIT);
  const hotIds = new Set(
    [...topics].sort((a, b) => b.trendScore - a.trendScore).slice(0, 3).map((t) => t.id)
  );

  // Arama motorlarına site kimliği ve site içi arama yeteneği
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        name: "TrendMatik",
        url: siteUrl(),
        inLanguage: "tr-TR",
        description:
          "Türkiye'de trend olan mekan, hizmet, website, konu, ürün ve haberlerin topluluk oylamalı sıralamaları.",
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: mutlak("/?ara={search_term_string}") },
          "query-input": "required name=search_term_string",
        },
      },
      {
        "@type": "Organization",
        name: "TrendMatik",
        url: siteUrl(),
        logo: mutlak("/favicon.ico"),
      },
      {
        "@type": "ItemList",
        name: "Türkiye'nin trend listeleri",
        numberOfItems: sorted.length,
        itemListElement: sorted.slice(0, 20).map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.title,
          url: mutlak(`/liste/${t.slug}`),
        })),
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="hero">
       {/* Arka plan efekti: sürüklenen ışık bulutları + canlı trend çubukları */}
       <div className="hero-fx" aria-hidden="true">
         <div className="fx-aurora" />
         <div className="fx-bars">
           {Array.from({ length: 24 }, (_, i) => (
             <span key={i} style={{ "--i": i } as React.CSSProperties} />
           ))}
         </div>
       </div>
       <div className="hero-inner hero-split">
        <div className="hero-copy">
        <span className="hero-live">
          <span className="nokta" aria-hidden="true" />
          {hero.topics.reduce((n, t) => n + t.voteCount, 0).toLocaleString("tr-TR")} oy şu an sıralamaları belirliyor
        </span>
        <h1>
          Türkiye'de ne trend?
          <br />
          <span className="vurgu">Sıralamayı sen belirle,</span>
          <br />
          <span className="rotator">
            <span>en çok konuşulanı</span>
            <span>en hızlı yükseleni</span>
            <span>en çok oylananı</span>
            <span>bu hafta zirvedekini</span>
          </span>{" "}
          gör.
        </h1>
        <p>
          Mekanlardan haberlere, ürünlerden gündem konularına — 10 maddelik sıralamaları
          topluluk oyluyor, listeler gündemle birlikte her gün değişiyor.
        </p>
        <div className="hero-pills">
          <span className="hero-pill">🗳️ Herkes oy verebilir</span>
          <span className="hero-pill">⚡ Üye oyu ×2</span>
          <span className="hero-pill">📈 Her gün güncellenir</span>
        </div>
       </div>
        <HeroFinder
          categories={hero.categories}
          topics={hero.topics}
          kategoriLimit={heroKategoriLimit}
        />
       </div>
      </section>

      <div className="container">
      <section className="section">
        <div className="section-head">
          <span className="eyebrow">{rising ? "Şu an yükselenler" : "Tüm zamanların popülerleri"}</span>
          <h2>{rising ? "Gündemde hızla tırmananlar" : "En çok oy toplayan listeler"}</h2>
          <p>
            {rising
              ? "Son saatlerde aldığı oylar ağırlıklandırılır; yeni trendler eskilerin önüne geçebilir."
              : "Toplam ağırlıklı oya göre sıralanır; üye oyları iki kat sayılır."}
          </p>
        </div>

        <div className="tabs">
          <Link href="/?sekme=yukselen" className={`tab ${rising ? "active" : ""}`}>
            🔥 Yükselenler
          </Link>
          <Link href="/?sekme=populer" className={`tab ${!rising ? "active" : ""}`}>
            ⭐ Popüler
          </Link>
        </div>

        <div className="topic-grid">
          {gosterilen.map((t) => (
            <TopicCard key={t.id} t={t} hot={hotIds.has(t.id)} />
          ))}
        </div>

        {/* Ana sayfa vitrindir, dizin değil: kalan listelere kategorilerden
            ulaşılır. Yüzlerce kartı birden basmak sayfayı megabaytlara çıkarıyordu. */}
        {sorted.length > gosterilen.length && (
          <div className="daha-fazla">
            <p>
              {sorted.length.toLocaleString("tr-TR")} listeden ilk {gosterilen.length} tanesi
              gösteriliyor.
            </p>
            <div className="daha-fazla-baglantilar">
              {categories.map((c) => (
                <Link key={c.id} href={`/kategori/${c.slug}`} className="btn btn-sm">
                  {c.emoji} {c.name}
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>
      </div>
    </>
  );
}
