import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getCategoryBySlug, getTopicSummaries } from "@/lib/db";
import { mutlak, ogTemel } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const category = await getCategoryBySlug(slug);
  if (!category) return {};
  const baslik = `${category.name} Trendleri`;
  const aciklama = `Türkiye'de ${category.name.toLocaleLowerCase("tr")} kategorisinde trend olanlar — topluluk oylamasıyla belirlenen 10'luk sıralamalar.`;
  return {
    title: baslik,
    description: aciklama,
    alternates: { canonical: mutlak(`/kategori/${slug}`) },
    openGraph: {
      ...ogTemel(),
      type: "website",
      title: baslik,
      description: aciklama,
      url: mutlak(`/kategori/${slug}`),
    },
  };
}

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

  // Kategori sayfası da bir sıralama listesi; arama motoruna öyle bildirilir
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: `${category.name} Trendleri`,
        url: mutlak(`/kategori/${slug}`),
        numberOfItems: topics.length,
        itemListElement: topics.map((t, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: t.title,
          url: mutlak(`/liste/${t.slug}`),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: mutlak("/") },
          { "@type": "ListItem", position: 2, name: category.name, item: mutlak(`/kategori/${slug}`) },
        ],
      },
    ],
  };

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
    </div>
  );
}
