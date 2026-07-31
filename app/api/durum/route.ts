import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Sağlık kontrolü — yayın sorunlarını dışarıdan teşhis etmek için.
 * Yalnızca "var/yok" bilgisi ve bağlantı sonucu döner; bağlantı adresi,
 * parola ya da anahtar gibi gizli değerler ASLA yazılmaz.
 */

/** Hata metinlerinden kimlik bilgisi taşıyabilecek kısımları temizler. */
function sanitize(msg: string): string {
  return msg
    .replace(/postgres(ql)?:\/\/\S+/gi, "postgresql://***")
    .replace(/password=\S+/gi, "password=***")
    .slice(0, 300);
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL?.trim() ?? "";
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  const onVercel = !!process.env.VERCEL;

  let port: number | null = null;
  try {
    if (dbUrl) port = Number(new URL(dbUrl).port) || null;
  } catch {
    port = null;
  }

  const degiskenler = {
    DATABASE_URL: dbUrl.length > 0,
    SESSION_SECRET: secret.length >= 16,
  };

  const veritabani: Record<string, unknown> = { baglanti: "denenmedi" };
  if (dbUrl) {
    try {
      // Şema kurulumunu tetiklemeden hafif bir sorgu çalıştır
      const { getCategories, getTopicSummaries } = await import("@/lib/db");
      const kategoriler = await getCategories();
      const basliklar = await getTopicSummaries();
      veritabani.baglanti = "ok";
      veritabani.kategoriSayisi = kategoriler.length;
      veritabani.baslikSayisi = basliklar.length;
      veritabani.tohumlandi = kategoriler.length > 0;
    } catch (err) {
      veritabani.baglanti = "hata";
      veritabani.hata = sanitize(err instanceof Error ? err.message : String(err));
    }
  }

  const eksikler: string[] = [];
  if (!degiskenler.DATABASE_URL) {
    eksikler.push("DATABASE_URL tanımlı değil — Supabase bağlantı adresini ekleyin.");
  }
  if (!degiskenler.SESSION_SECRET) {
    eksikler.push("SESSION_SECRET tanımlı değil (en az 16 karakter olmalı).");
  }
  if (dbUrl && onVercel && port === 5432) {
    eksikler.push(
      "Doğrudan bağlantı (5432) kullanılıyor — sunucusuz ortamda Transaction pooler (6543) tercih edin."
    );
  }
  if (veritabani.baglanti === "hata") {
    eksikler.push("Veritabanına bağlanılamadı; ayrıntı için 'veritabani.hata' alanına bakın.");
  }

  const ok = eksikler.length === 0;
  return NextResponse.json(
    {
      ok,
      ortam: onVercel ? "vercel" : "yerel",
      surucu: dbUrl ? "postgres" : "sqlite",
      port,
      degiskenler,
      sessionSecretUzunluk: secret.length, // yalnızca uzunluk, değer değil
      veritabani,
      eksikler,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
