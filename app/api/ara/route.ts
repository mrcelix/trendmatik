import { NextRequest, NextResponse } from "next/server";
import { aramaYap } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Üst bar araması. İstemci en az 3 karakter yazınca çağırır.
 * Sonuçlar kısa süre önbelleklenir: aynı terim art arda yazılırken
 * (kullanıcı harf sildiğinde) tekrar veritabanına gitmesin.
 */
export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const q = (p.get("q") ?? "").slice(0, 60);
  if (q.trim().length < 3) {
    return NextResponse.json({ sonuclar: [] });
  }

  const sonuclar = await aramaYap(q, {
    tur: p.get("tur") ?? undefined,
    kategori: p.get("kategori") ?? undefined,
    sehir: p.get("sehir") ?? undefined,
  });

  return NextResponse.json(
    { sonuclar },
    { headers: { "Cache-Control": "private, max-age=30" } }
  );
}
