import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Sağlık kontrolü — yayın sorunlarını dışarıdan teşhis etmek için.
 * Yalnızca "var/yok" bilgisi ve bağlantı sonucu döner; bağlantı adresi,
 * parola ya da anahtar gibi gizli değerler ASLA yazılmaz.
 */

/**
 * Hata metinlerinden kimlik bilgisi ve proje kimliği taşıyan kısımları temizler.
 * Sunucu adının yalnızca son iki etiketi bırakılır: db.abc123.supabase.co → ***.supabase.co
 */
function sanitize(msg: string): string {
  return msg
    .replace(/postgres(ql)?:\/\/\S+/gi, "postgresql://***")
    .replace(/password=\S+/gi, "password=***")
    .replace(/\b(?:[a-z0-9-]+\.)+([a-z0-9-]+\.[a-z]{2,})\b/gi, "***.$1")
    .slice(0, 300);
}

/**
 * Hata nesnesinden okunabilir metin çıkarır.
 * Node bağlantı denemelerinde AggregateError üretir ve bunun message alanı
 * boştur; asıl sebep errors dizisinin içindedir (ENETUNREACH, ECONNREFUSED…).
 */
function describeError(err: unknown): string {
  if (err instanceof AggregateError && Array.isArray(err.errors)) {
    const icerik = err.errors
      .map((e) => {
        const x = e as { code?: string; message?: string };
        return [x.code, x.message].filter(Boolean).join(" ");
      })
      .filter(Boolean);
    const benzersiz = [...new Set(icerik)];
    return `AggregateError: ${benzersiz.join(" | ") || "ayrıntı yok"}`;
  }
  const e = err as { code?: string; message?: string };
  const metin = [e?.code, e?.message].filter(Boolean).join(" ").trim();
  return metin || String(err) || "bilinmeyen hata";
}

export async function GET() {
  const dbUrl = process.env.DATABASE_URL?.trim() ?? "";
  const secret = process.env.SESSION_SECRET?.trim() ?? "";
  const onVercel = !!process.env.VERCEL;

  let port: number | null = null;
  let baglantiTipi: "pooler" | "dogrudan" | null = null;
  try {
    if (dbUrl) {
      const u = new URL(dbUrl);
      port = Number(u.port) || null;
      // Pooler: aws-0-<bolge>.pooler.supabase.com  /  Doğrudan: db.<proje>.supabase.co
      baglantiTipi = u.hostname.includes(".pooler.") ? "pooler" : "dogrudan";
    }
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
      const t0 = Date.now();
      const kategoriler = await getCategories();
      const basliklar = await getTopicSummaries();
      veritabani.sureMs = Date.now() - t0; // ana sayfa sorgularının toplam süresi
      veritabani.baglanti = "ok";
      veritabani.kategoriSayisi = kategoriler.length;
      veritabani.baslikSayisi = basliklar.length;
      veritabani.tohumlandi = kategoriler.length > 0;
    } catch (err) {
      veritabani.baglanti = "hata";
      veritabani.hata = sanitize(describeError(err));
    }
  }

  const eksikler: string[] = [];
  if (!degiskenler.DATABASE_URL) {
    eksikler.push("DATABASE_URL tanımlı değil — Supabase bağlantı adresini ekleyin.");
  }
  if (!degiskenler.SESSION_SECRET) {
    eksikler.push("SESSION_SECRET tanımlı değil (en az 16 karakter olmalı).");
  }
  if (dbUrl && onVercel && baglantiTipi === "dogrudan") {
    eksikler.push(
      "Sunucu adı doğrudan bağlantıya ait (db.<proje>.supabase.co). Sunucusuz ortamda çözülemez; " +
        "Supabase → Connect → Transaction pooler adresini kullanın (…pooler.supabase.com:6543, " +
        "kullanıcı adı postgres.<proje>)."
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
      baglantiTipi,
      degiskenler,
      sessionSecretUzunluk: secret.length, // yalnızca uzunluk, değer değil
      veritabani,
      eksikler,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } }
  );
}
