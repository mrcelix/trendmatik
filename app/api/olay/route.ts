import { NextRequest, NextResponse } from "next/server";
import { olayKaydet } from "@/lib/db";
import { getVisitorId } from "@/lib/auth";

/**
 * Sayfa görüntüleme ve tıklama olaylarını kaydeder.
 * Kimlik olarak yalnızca mevcut ziyaretçi çerezi kullanılır; IP ya da
 * başka kişisel veri saklanmaz.
 */
export async function POST(req: NextRequest) {
  let govde: { tur?: string; yol?: string; hedef?: string };
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const tur = String(govde.tur ?? "").slice(0, 20);
  if (!["goruntuleme", "tiklama"].includes(tur)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const vid = await getVisitorId();
  await olayKaydet(tur, String(govde.yol ?? ""), String(govde.hedef ?? ""), vid ? `guest-${vid}` : "");

  return NextResponse.json({ ok: true });
}
