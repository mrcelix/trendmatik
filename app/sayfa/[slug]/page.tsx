import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getSayfaBySlug } from "@/lib/db";
import { mutlak, ogTemel } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const sayfa = await getSayfaBySlug(slug);
  if (!sayfa || sayfa.durum !== "yayinda") return {};

  return {
    title: sayfa.baslik,
    description: sayfa.ozet || undefined,
    alternates: { canonical: mutlak(`/sayfa/${sayfa.slug}`) },
    openGraph: {
      ...(await ogTemel()),
      type: "article",
      title: sayfa.baslik,
      description: sayfa.ozet || undefined,
      url: mutlak(`/sayfa/${sayfa.slug}`),
    },
  };
}

/**
 * Sade biçimlendirme: boş satır paragrafı ayırır, "## " ile başlayan satır
 * ara başlık olur. İçerik HTML olarak basılmıyor — yönetici metni yanlışlıkla
 * ya da kasten script gömerse çalışmasın diye metin olarak render ediliyor.
 */
function govde(icerik: string) {
  return icerik
    .split(/\n{2,}/)
    .map((blok) => blok.trim())
    .filter(Boolean)
    .map((blok, i) =>
      blok.startsWith("## ") ? (
        <h2 key={i} style={{ fontSize: "1.15rem", margin: "22px 0 8px" }}>
          {blok.slice(3).trim()}
        </h2>
      ) : (
        <p key={i} style={{ margin: "0 0 12px", lineHeight: 1.7 }}>
          {blok.split("\n").map((satir, j, hepsi) => (
            <span key={j}>
              {satir}
              {j < hepsi.length - 1 && <br />}
            </span>
          ))}
        </p>
      )
    );
}

export default async function SayfaGoster({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const sayfa = await getSayfaBySlug(slug);
  // Taslaklar yayında değil: adresi bilen de göremez
  if (!sayfa || sayfa.durum !== "yayinda") notFound();

  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebPage",
        name: sayfa.baslik,
        url: mutlak(`/sayfa/${sayfa.slug}`),
        ...(sayfa.ozet ? { description: sayfa.ozet } : {}),
        dateModified: new Date(sayfa.updated_at * 1000).toISOString(),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: mutlak("/") },
          { "@type": "ListItem", position: 2, name: sayfa.baslik, item: mutlak(`/sayfa/${sayfa.slug}`) },
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
        <Link href="/">Ana Sayfa</Link> › {sayfa.baslik}
      </div>

      <article className="form-card wide sayfa-govde">
        <h1>{sayfa.baslik}</h1>
        {sayfa.icerik.trim() ? (
          govde(sayfa.icerik)
        ) : (
          <p className="form-note">Bu sayfanın içeriği henüz yazılmadı.</p>
        )}
        <p className="dim" style={{ fontSize: 12.5, marginTop: 24 }}>
          Son güncelleme: {new Date(sayfa.updated_at * 1000).toLocaleDateString("tr-TR")}
        </p>
      </article>
    </div>
  );
}
