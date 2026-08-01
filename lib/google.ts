import { randomBytes } from "node:crypto";
import { siteUrl } from "./site";

/**
 * Google ile giriş.
 * Kimlik bilgileri tanımlı değilse özellik tamamen kapalıdır; arayüzde
 * düğme gösterilmez ve uçlar 404 döner. Böylece yapılandırma yapılmadan
 * da site sorunsuz çalışır.
 */

export function googleAcikMi(): boolean {
  return !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

export function yonlendirmeAdresi(): string {
  return `${siteUrl()}/api/auth/google/geri`;
}

export function stateUret(): string {
  return randomBytes(16).toString("hex");
}

/** Kullanıcının yönlendirileceği Google onay adresi. */
export function googleYetkiAdresi(state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: yonlendirmeAdresi(),
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });
  return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
}

export type GoogleProfil = { googleId: string; email: string; ad: string; dogrulanmis: boolean };

/** Yetki kodunu jetona çevirir ve kullanıcı bilgilerini getirir. */
export async function googleProfilAl(code: string): Promise<GoogleProfil | null> {
  const jeton = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: yonlendirmeAdresi(),
      grant_type: "authorization_code",
    }),
  });
  if (!jeton.ok) return null;

  const { access_token } = (await jeton.json()) as { access_token?: string };
  if (!access_token) return null;

  const bilgi = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${access_token}` },
  });
  if (!bilgi.ok) return null;

  const p = (await bilgi.json()) as {
    sub?: string;
    email?: string;
    email_verified?: boolean;
    name?: string;
  };
  if (!p.sub || !p.email) return null;

  return {
    googleId: p.sub,
    email: p.email.toLowerCase(),
    ad: p.name ?? p.email.split("@")[0],
    dogrulanmis: p.email_verified !== false,
  };
}
