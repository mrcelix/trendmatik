import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategoryBySlug, getTopicSummaries } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function CategoryPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ sekme?: string }>;
}) {
  const { slug } = await params;
  const { sekme } = await searchParams;
  const category = await getCategoryBySlug(slug);
  if (!category) notFound();

  const rising = sekme === "yukselen";
  const topics = (await getTopicSummaries(category.id)).sort((a, b) =>
    rising ? b.trendScore - a.trendScore : b.popScore - a.popScore
  );

  return (
    <>
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> › {category.name}
      </div>
      <div className="page-head">
        <h1>
          {category.emoji} {category.name} Trendleri
        </h1>
        <span className="sub">{topics.length} başlık</span>
      </div>

      <div className="tabs">
        <Link href={`/kategori/${slug}`} className={`tab ${!rising ? "active" : ""}`}>
          ⭐ Popüler
        </Link>
        <Link href={`/kategori/${slug}?sekme=yukselen`} className={`tab ${rising ? "active" : ""}`}>
          🔥 Yükselenler
        </Link>
      </div>

      <div className="topic-grid">
        {topics.map((t) => (
          <Link key={t.id} href={`/liste/${t.slug}`} className="topic-card">
            <div className="cat-line">
              {t.city && <span className="city-tag">{t.city}</span>}
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
        ))}
        {topics.length === 0 && (
          <p className="admin-empty">Bu kategoride henüz onaylı başlık yok. İlk başlığı sen öner!</p>
        )}
      </div>
    </>
  );
}
