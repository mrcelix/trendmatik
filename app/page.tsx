import Link from "next/link";
import { getTopicSummaries, type TopicSummary } from "@/lib/db";

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
  const topics = await getTopicSummaries();

  const sorted = [...topics].sort((a, b) =>
    rising ? b.trendScore - a.trendScore : b.popScore - a.popScore
  );
  const hotIds = new Set(
    [...topics].sort((a, b) => b.trendScore - a.trendScore).slice(0, 3).map((t) => t.id)
  );

  return (
    <>
      <section className="hero">
        <h1>Türkiye'de şu an ne trend?</h1>
        <p>
          Mekanlardan haberlere, ürünlerden gündem konularına — 10 maddelik sıralamaları
          topluluk oyluyor, listeler gündemle birlikte her gün değişiyor. Üye ol, oyun ×2 sayılsın.
        </p>
      </section>

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
    </>
  );
}
