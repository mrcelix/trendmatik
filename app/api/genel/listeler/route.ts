import { NextResponse } from "next/server";
import { getAllApprovedTopics } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Tüm uçlarda ortak: herkese açık okuma, 5 dakika kenar önbelleği. */
export const GENEL_BASLIKLAR = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
};

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: GENEL_BASLIKLAR });
}

/**
 * Yayındaki listelerin dizini.
 * Kimlik doğrulaması yok; yalnızca zaten herkese açık veriler dönüyor.
 */
export async function GET() {
  const listeler = await getAllApprovedTopics();

  return NextResponse.json(
    {
      kaynak: "TrendMatik",
      adres: siteUrl(),
      lisans: "Kaynak göstererek serbestçe kullanılabilir.",
      sayi: listeler.length,
      listeler: listeler.map((t) => ({
        slug: t.slug,
        baslik: t.title,
        aciklama: t.description,
        kategori: t.categorySlug ?? null,
        sehir: t.city ?? null,
        adres: `${siteUrl()}/liste/${t.slug}`,
        veri: `${siteUrl()}/api/genel/liste/${t.slug}`,
        gomulu: `${siteUrl()}/gomulu/${t.slug}`,
      })),
    },
    { headers: GENEL_BASLIKLAR }
  );
}
