import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getTopicBoard, getTopicBySlug, ozellikAcik } from "@/lib/db";
import { mutlak, ogTemel } from "@/lib/site";
import SampiyonlarTuru, { type TurMaddesi } from "@/components/SampiyonlarTuru";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) return {};
  const baslik = `${topic.title} — Şampiyonlar Turu`;
  const aciklama = `${topic.title} listesinde eleme usulü turnuva: 8 aday, 7 eşleşme, tek şampiyon. Sen kimi seçersin?`;

  return {
    title: baslik,
    description: aciklama,
    alternates: { canonical: mutlak(`/turnuva/${slug}`) },
    openGraph: {
      ...(await ogTemel()),
      title: baslik,
      description: aciklama,
      url: mutlak(`/turnuva/${slug}`),
      images: [{ url: mutlak(`/api/kart/${slug}`), width: 1200, height: 630 }],
    },
  };
}

export default async function TurnuvaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") notFound();

  // Turnuva düello altyapısını kullanıyor; düello kapalıysa burası da kapalı
  if (!(await ozellikAcik("duello_acik"))) {
    return (
      <div className="container">
        <div className="page-head">
          <h1>🏆 Şampiyonlar Turu</h1>
        </div>
        <p className="admin-empty">
          İkili karşılaştırma şu anda kapalı.{" "}
          <Link href={`/liste/${slug}`}>Listeye dön</Link>
        </p>
      </div>
    );
  }

  const { top } = await getTopicBoard(topic.id);
  const maddeler: TurMaddesi[] = top.slice(0, 8).map((i) => ({
    id: i.id,
    ad: i.name,
    gorsel: i.gorsel ?? "",
    sira: i.rank,
  }));

  return (
    <div className="container turnuva-sayfa">
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> ›{" "}
        <Link href={`/liste/${topic.slug}`}>{topic.title}</Link> › Şampiyonlar Turu
      </div>

      <div className="page-head">
        <h1>🏆 Şampiyonlar Turu</h1>
        <span className="sub">{topic.title}</span>
      </div>

      <p className="form-note" style={{ marginTop: 0 }}>
        Listenin ilk 8 maddesi eleme usulü karşılaşıyor: 1-8, 2-7, 3-6, 4-5.
        En güçlü adaylar finale kadar birbirine denk gelmiyor.
      </p>

      <SampiyonlarTuru slug={topic.slug} listeBasligi={topic.title} maddeler={maddeler} />
    </div>
  );
}
