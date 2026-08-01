import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { googleAcikMi, googleProfilAl } from "@/lib/google";
import {
  benzersizGorunenAd, createUser, getUserByEmail, getUserByGoogleId, googleBagla,
} from "@/lib/db";
import { hashPassword, setSessionCookie } from "@/lib/auth";
import { randomBytes } from "node:crypto";
import { siteUrl } from "@/lib/site";

/** Google'dan dönüş: kodu profile çevirir, hesabı bulur ya da açar. */
export async function GET(req: NextRequest) {
  if (!googleAcikMi()) {
    return NextResponse.json({ hata: "Google ile giriş yapılandırılmamış." }, { status: 404 });
  }

  const hataYolu = (mesaj: string) =>
    NextResponse.redirect(`${siteUrl()}/giris?e=${encodeURIComponent(mesaj)}`);

  const kod = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const jar = await cookies();
  const beklenen = jar.get("g_state")?.value;
  jar.delete("g_state");

  if (req.nextUrl.searchParams.get("error")) {
    return hataYolu("Google girişi iptal edildi.");
  }
  // State eşleşmiyorsa istek bizim başlattığımız akıştan gelmiyor demektir
  if (!kod || !state || !beklenen || state !== beklenen) {
    return hataYolu("Google girişi doğrulanamadı, tekrar deneyin.");
  }

  const profil = await googleProfilAl(kod);
  if (!profil) return hataYolu("Google bilgileri alınamadı.");
  if (!profil.dogrulanmis) return hataYolu("Google hesabının e-postası doğrulanmamış.");

  // 1) Daha önce Google ile bağlanmış hesap
  let user = await getUserByGoogleId(profil.googleId);

  // 2) Aynı e-postayla açılmış hesap varsa Google'ı ona bağla
  if (!user) {
    const mevcut = await getUserByEmail(profil.email);
    if (mevcut) {
      await googleBagla(mevcut.id, profil.googleId);
      user = mevcut;
    }
  }

  // 3) Yoksa yeni hesap aç — parola alanı rastgele doldurulur, kullanılmaz
  if (!user) {
    const ad = await benzersizGorunenAd(profil.ad);
    const id = await createUser({
      email: profil.email,
      username: ad,
      passHash: hashPassword(randomBytes(24).toString("hex")),
      googleId: profil.googleId,
    });
    await setSessionCookie(id);
    return NextResponse.redirect(`${siteUrl()}/?hosgeldin=1`);
  }

  if (Number(user.askida ?? 0) === 1) {
    return hataYolu("Bu hesap askıya alınmış.");
  }

  await setSessionCookie(user.id);
  return NextResponse.redirect(`${siteUrl()}/`);
}
