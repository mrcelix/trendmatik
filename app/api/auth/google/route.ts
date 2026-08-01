import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleAcikMi, googleYetkiAdresi, stateUret } from "@/lib/google";

/** Google onay ekranına yönlendirir. State çerezi CSRF'e karşı koruma sağlar. */
export async function GET() {
  if (!googleAcikMi()) {
    return NextResponse.json(
      { hata: "Google ile giriş yapılandırılmamış." },
      { status: 404 }
    );
  }

  const state = stateUret();
  const jar = await cookies();
  jar.set("g_state", state, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 600, // 10 dakika
    path: "/",
  });

  return NextResponse.redirect(googleYetkiAdresi(state));
}
