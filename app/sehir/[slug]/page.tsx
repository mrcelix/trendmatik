import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSehirDetay } from "@/lib/db";
import { mutlak, ogTemel } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const d = await getSehirDetay(slug);
  if (!d) return {};
  const baslik = `${d.sehir}'da Trend Olanlar`;
  const aciklama = `${d.sehir} için topluluk oylamalı trend sıralamaları — ${d.listeler.length} liste, her gün güncelleniyor.`;
  return {
    title: baslik,
    description: aciklama,
    alternates: { canonical: mutlak(`/sehir/${slug}`) },
    openGraph: {
      ...ogTemel(),
      type: "website",
      title: baslik,
      description: aciklama,
      url: mutlak(`/sehir/${slug}`),
    },
  };
}

export default async function SehirPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const detay = await getSehirDetay(slug);
  if (!detay) notFound();

  const { sehir, listeler } = detay;

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${sehir}'da Trend Olanlar`,
    url: mutlak(`/sehir/${slug}`),
    numberOfItems: listeler.length,
    itemListElement: listeler.map((t, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: t.title,
      url: mutlak(`/liste/${t.slug}`),
    })),
  };

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> › <Link href="/sehir">Şehirler</Link> › {sehir}
      </div>
      <div className="page-head">
        <h1>📍 {sehir}&apos;da Trend Olanlar</h1>
        <span className="sub">{listeler.length} liste</span>
      </div>

      <div className="topic-grid">
        {listeler.map((t) => (
          <Link key={t.id} href={`/liste/${t.slug}`} className="topic-card">
            <div className="cat-line">
              <span>
                {t.categoryEmoji} {t.categoryName}
              </span>
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
      </div>
    </div>
  );
}
