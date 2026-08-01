import { NextResponse } from "next/server";
import { getTopicBoard, getTopicBySlug } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { GENEL_BASLIKLAR } from "../../listeler/route";

export const dynamic = "force-dynamic";

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: GENEL_BASLIKLAR });
}

/** Tek bir listenin güncel sıralaması. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") {
    return NextResponse.json({ hata: "Liste bulunamadı." }, { status: 404, headers: GENEL_BASLIKLAR });
  }

  const { top, rerankKisi } = await getTopicBoard(topic.id);

  return NextResponse.json(
    {
      kaynak: "TrendMatik",
      slug: topic.slug,
      baslik: topic.title,
      aciklama: topic.description,
      sehir: topic.city ?? null,
      adres: `${siteUrl()}/liste/${topic.slug}`,
      guncellendi: new Date().toISOString(),
      siralayanKisi: rerankKisi,
      maddeler: top.map((i) => ({
        sira: i.rank,
        ad: i.name,
        puan: Math.round(i.popScore),
        oy: i.voteCount,
        // null = önceki günde yoktu (yeni giren madde)
        degisim: i.delta,
        gorsel: i.gorsel || null,
        site: i.site || null,
      })),
    },
    { headers: GENEL_BASLIKLAR }
  );
}
