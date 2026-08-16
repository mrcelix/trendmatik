import Link from "next/link";
import type { Metadata } from "next";
import { getYayindakiYazilar } from "@/lib/db";
import { mutlak, ogTemel } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Blog",
  description:
    "TrendMatik blogu — Türkiye'nin trend sıralamaları üzerine analizler, haftalık değerlendirmeler ve gündem yazıları.",
  alternates: { canonical: mutlak("/blog") },
  openGraph: {
    ...(await ogTemel()),
    type: "website",
    title: "Blog",
    description: "Trend sıralamaları üzerine analizler ve gündem yazıları.",
    url: mutlak("/blog"),
  },
};

export default async function BlogPage() {
  const yazilar = await getYayindakiYazilar();

  // Arama motorları için: yazı listesi + ekmek kırıntısı
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Blog",
        name: "TrendMatik Blog",
        url: mutlak("/blog"),
        blogPost: yazilar.slice(0, 20).map((y) => ({
          "@type": "BlogPosting",
          headline: y.baslik,
          url: mutlak(`/blog/${y.slug}`),
          datePublished: new Date(y.created_at * 1000).toISOString(),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: mutlak("/") },
          { "@type": "ListItem", position: 2, name: "Blog", item: mutlak("/blog") },
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
        <Link href="/">Ana Sayfa</Link> › Blog
      </div>
      <div className="page-head">
        <h1>📝 Blog</h1>
        <span className="sub">{yazilar.length} yazı</span>
      </div>

      {yazilar.length === 0 && (
        <p className="admin-empty">Henüz yazı yayınlanmadı. Yakında burada olacağız.</p>
      )}

      <div className="topic-grid">
        {yazilar.map((y) => (
          <Link key={y.id} href={`/blog/${y.slug}`} className="topic-card">
            <div className="cat-line">
              <span>
                {new Date(y.created_at * 1000).toLocaleDateString("tr-TR", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              {y.yazar && <span>· {y.yazar}</span>}
            </div>
            <h3>{y.baslik}</h3>
            {y.ozet && <div className="preview">{y.ozet}</div>}
            <div className="stats">
              <span>👁️ {y.goruntulenme} görüntülenme</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
