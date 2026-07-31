import Link from "next/link";
import { getHeroData, getTopicSummaries, type TopicSummary } from "@/lib/db";
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
  const [topics, hero] = await Promise.all([getTopicSummaries(), getHeroData()]);

  const sorted = [...topics].sort((a, b) =>
    rising ? b.trendScore - a.trendScore : b.popScore - a.popScore
  );
  const hotIds = new Set(
    [...topics].sort((a, b) => b.trendScore - a.trendScore).slice(0, 3).map((t) => t.id)
  );

  return (
    <>
      <section className="hero hero-split">
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
       <HeroFinder categories={hero.categories} topics={hero.topics} />
      </section>

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
          {sorted.map((t) => (
            <TopicCard key={t.id} t={t} hot={hotIds.has(t.id)} />
          ))}
        </div>
      </section>
    </>
  );
}
