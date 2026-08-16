import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { blogGoruntulendi, getBlogYazi } from "@/lib/db";
import { mutlak, ogTemel } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const y = await getBlogYazi(slug);
  if (!y || y.durum !== "yayinda") return {};
  return {
    title: y.baslik,
    description: y.ozet || y.icerik.slice(0, 155),
    alternates: { canonical: mutlak(`/blog/${slug}`) },
    openGraph: {
      ...(await ogTemel()),
      type: "article",
      title: y.baslik,
      description: y.ozet,
      url: mutlak(`/blog/${slug}`),
      publishedTime: new Date(y.created_at * 1000).toISOString(),
      ...(y.kapak ? { images: [{ url: y.kapak }] } : {}),
    },
  };
}

/**
 * Basit metin biçimlendirme: boş satır = paragraf, "## " = ara başlık.
 * Tarayıcılar textarea içeriğini CRLF ile gönderdiği için satır sonları
 * önce normalleştirilir; aksi halde paragraf ayırma hiç çalışmaz.
 */
function icerikBloklari(metin: string) {
  return metin
    .replace(/\r\n?/g, "\n")
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default async function BlogYaziPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const yazi = await getBlogYazi(slug);
  if (!yazi || yazi.durum !== "yayinda") notFound();

  await blogGoruntulendi(yazi.id);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BlogPosting",
    headline: yazi.baslik,
    description: yazi.ozet,
    url: mutlak(`/blog/${yazi.slug}`),
    datePublished: new Date(yazi.created_at * 1000).toISOString(),
    dateModified: new Date(yazi.updated_at * 1000).toISOString(),
    author: { "@type": "Person", name: yazi.yazar ?? "TrendMatik" },
    publisher: { "@type": "Organization", name: "TrendMatik" },
    ...(yazi.kapak ? { image: yazi.kapak } : {}),
  };

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> › <Link href="/blog">Blog</Link> › {yazi.baslik}
      </div>

      <article className="yazi">
        <h1>{yazi.baslik}</h1>
        <p className="yazi-ust">
          {new Date(yazi.created_at * 1000).toLocaleDateString("tr-TR", {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
          {yazi.yazar && ` · ${yazi.yazar}`}
        </p>

        {yazi.kapak && (
          // eslint-disable-next-line @next/next/no-img-element
          <img className="yazi-kapak" src={yazi.kapak} alt="" />
        )}

        {yazi.ozet && <p className="yazi-ozet">{yazi.ozet}</p>}

        <div className="yazi-govde">
          {icerikBloklari(yazi.icerik).map((blok, i) =>
            blok.startsWith("## ") ? (
              <h2 key={i}>{blok.slice(3)}</h2>
            ) : (
              <p key={i}>{blok}</p>
            )
          )}
          {yazi.icerik.trim() === "" && (
            <p className="dim">Bu yazının içeriği henüz eklenmemiş.</p>
          )}
        </div>
      </article>
    </div>
  );
}
