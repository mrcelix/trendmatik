import { NextRequest, NextResponse } from "next/server";
import { pushAboneEkle, pushAboneSil } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { pushAcikMi } from "@/lib/push";

/**
 * Push aboneliği kaydı ve iptali.
 * Abonelik kullanıcıya bağlanır; bildirimler yalnızca takip edilen
 * listelerdeki hareketler için gider.
 */
export async function POST(req: NextRequest) {
  if (!pushAcikMi()) {
    return NextResponse.json({ hata: "Push yapılandırılmamış." }, { status: 404 });
  }
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ hata: "Önce giriş yapın." }, { status: 401 });
  }

  let govde: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ hata: "Geçersiz istek." }, { status: 400 });
  }

  const { endpoint, keys } = govde;
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ hata: "Eksik abonelik bilgisi." }, { status: 400 });
  }
  // Push servis adresleri her zaman https'tir; başka şema kabul etmiyoruz
  if (!endpoint.startsWith("https://") || endpoint.length > 800) {
    return NextResponse.json({ hata: "Geçersiz abonelik adresi." }, { status: 400 });
  }

  await pushAboneEkle({
    userId: user.id,
    endpoint,
    p256dh: keys.p256dh,
    auth: keys.auth,
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  let govde: { endpoint?: string };
  try {
    govde = await req.json();
  } catch {
    return NextResponse.json({ hata: "Geçersiz istek." }, { status: 400 });
  }
  if (govde.endpoint) await pushAboneSil(govde.endpoint);
  return NextResponse.json({ ok: true });
}
