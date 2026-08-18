import { NextRequest, NextResponse } from "next/server";
import { canliGoruntuleyen } from "@/lib/db";

export const dynamic = "force-dynamic";

/**
 * Bir sayfayı şu anda görüntüleyen benzersiz ziyaretçi sayısı.
 *
 * Gerçek ölçüm döner; veri yoksa 0 döner — rozet o durumda kendini
 * gizler. Sayı uydurulmaz.
 */
export async function GET(req: NextRequest) {
  const yol = req.nextUrl.searchParams.get("yol") ?? "";
  // Yalnızca site içi yollar; başka bir şey sorulmasın
  if (!yol.startsWith("/") || yol.length > 200 || yol.startsWith("/admin")) {
    return NextResponse.json({ sayi: 0 }, { status: 400 });
  }

  const sayi = await canliGoruntuleyen(yol, 5);
  return NextResponse.json(
    { sayi, dakika: 5 },
    { headers: { "Cache-Control": "no-store" } }
  );
}
