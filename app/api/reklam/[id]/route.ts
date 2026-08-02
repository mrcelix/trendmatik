import { NextResponse } from "next/server";
import { reklamTiklandi } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Sponsor bağlantısı geçişi. Tıklama sayacını artırır ve hedefe yönlendirir.
 *
 * Gösterim değil yalnızca tıklama sayılıyor: her sayfa görüntülemesinde
 * yazma yapmak sıralamaların okunma hızını düşürürdü.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const adres = await reklamTiklandi(Number(id));

  // Adres yönetici tarafından girilir ama yine de doğrulanıyor: açık
  // yönlendirici hâline gelmemesi için yalnızca https kabul ediliyor.
  if (!adres || !adres.startsWith("https://")) {
    return NextResponse.redirect(siteUrl());
  }
  return NextResponse.redirect(adres);
}
