import { NextRequest, NextResponse } from "next/server";
import { gundemTaramasi } from "@/lib/gundem";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Zamanlanmış gündem taraması (Vercel Cron).
 *
 * Vercel cron isteklerine `Authorization: Bearer $CRON_SECRET` başlığı ekler.
 * CRON_SECRET tanımlı değilse uç kapalıdır — aksi halde herkes tarama
 * tetikleyip dış beslemeye yük bindirebilirdi.
 */
export async function GET(req: NextRequest) {
  const gizli = process.env.CRON_SECRET?.trim();
  if (!gizli) {
    return NextResponse.json({ hata: "CRON_SECRET tanımlı değil." }, { status: 404 });
  }
  if (req.headers.get("authorization") !== `Bearer ${gizli}`) {
    return NextResponse.json({ hata: "Yetkisiz." }, { status: 401 });
  }

  const sonuc = await gundemTaramasi(true);
  return NextResponse.json(sonuc);
}
