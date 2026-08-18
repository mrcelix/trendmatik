import { NextRequest, NextResponse } from "next/server";
import { bugunkuOy, getTopicBySlug } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Bir listeye bugün verilen oy sayısı. Gerçek sayıdır; veri yoksa 0 döner
 * ve rozet kendini gizler.
 */
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get("liste") ?? "";
  if (!slug || slug.length > 120) {
    return NextResponse.json({ oy: 0 }, { status: 400 });
  }

  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") {
    return NextResponse.json({ oy: 0 }, { status: 404 });
  }

  const oy = await bugunkuOy(topic.id);
  return NextResponse.json({ oy }, { headers: { "Cache-Control": "no-store" } });
}
