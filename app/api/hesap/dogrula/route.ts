import { NextRequest, NextResponse } from "next/server";
import { epostaDogrulandiIsaretle, jetonTuket } from "@/lib/db";
import { jetonOzeti, setSessionCookie } from "@/lib/auth";
import { siteUrl } from "@/lib/site";

/** E-postadaki doğrulama bağlantısı. Jeton tek kullanımlıktır. */
export async function GET(req: NextRequest) {
  const ham = req.nextUrl.searchParams.get("t");
  if (!ham) return NextResponse.redirect(`${siteUrl()}/?dogrulama=gecersiz`);

  const userId = await jetonTuket("dogrula", jetonOzeti(ham));
  if (!userId) return NextResponse.redirect(`${siteUrl()}/?dogrulama=gecersiz`);

  await epostaDogrulandiIsaretle(userId);
  // Bağlantı başka bir cihazda açılmış olabilir; oturumu orada da açalım
  await setSessionCookie(userId);
  return NextResponse.redirect(`${siteUrl()}/?dogrulama=tamam`);
}
