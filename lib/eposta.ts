import { siteUrl } from "./site";
import { hataBildir } from "./hata";

/**
 * E-posta gönderimi (Resend HTTP API — SDK bağımlılığı yok).
 *
 * RESEND_API_KEY tanımlı değilse özellik kapalıdır: gönderim denenmez,
 * bunun yerine bağlantı sunucu kaydına yazılır. Böylece yerelde
 * yapılandırma olmadan da doğrulama/sıfırlama akışları test edilebilir.
 */

export function epostaAcikMi(): boolean {
  return !!process.env.RESEND_API_KEY;
}

function gonderen(): string {
  // Resend'de doğrulanmış alan adı gerekir; yoksa onboarding adresi çalışır
  return process.env.EPOSTA_GONDEREN?.trim() || "TrendMatik <onboarding@resend.dev>";
}

export type EpostaSonuc = { ok: boolean; kapali?: boolean; hata?: string };

export async function epostaGonder(opts: {
  kime: string;
  konu: string;
  html: string;
  metin: string;
}): Promise<EpostaSonuc> {
  if (!epostaAcikMi()) {
    // Yapılandırma yoksa bağlantıyı kayda düş: yerel geliştirmede tek yol bu
    console.info(
      JSON.stringify({
        seviye: "info",
        nerede: "eposta:kapali",
        kime: opts.kime,
        konu: opts.konu,
        metin: opts.metin,
      })
    );
    return { ok: false, kapali: true };
  }

  try {
    const cevap = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: gonderen(),
        to: [opts.kime],
        subject: opts.konu,
        html: opts.html,
        text: opts.metin,
      }),
    });

    if (!cevap.ok) {
      const govde = await cevap.text();
      hataBildir(new Error(`Resend ${cevap.status}: ${govde.slice(0, 200)}`), {
        nerede: "eposta:gonderim",
        ek: { konu: opts.konu },
      });
      return { ok: false, hata: "E-posta gönderilemedi." };
    }
    return { ok: true };
  } catch (e) {
    hataBildir(e, { nerede: "eposta:gonderim", ek: { konu: opts.konu } });
    return { ok: false, hata: "E-posta gönderilemedi." };
  }
}

// ---- Şablon ------------------------------------------------------------------

const MARKA = "#3a45e0";

/** Ortak gövde: tek sütun, satır içi stil (e-posta istemcileri <style> desteklemez). */
function kabuk(baslik: string, icerik: string, altNot?: string): string {
  return `<!doctype html><html lang="tr"><body style="margin:0;padding:0;background:#f7f8fb;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f7f8fb;padding:32px 12px;">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:#ffffff;border:1px solid #e6e8f0;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
<tr><td style="padding:22px 26px;border-bottom:1px solid #eef0f6;">
<span style="font-size:17px;font-weight:800;color:#16203a;">Trend<span style="color:${MARKA};">Matik</span></span>
</td></tr>
<tr><td style="padding:26px;">
<h1 style="margin:0 0 14px;font-size:19px;font-weight:700;color:#16203a;">${baslik}</h1>
${icerik}
</td></tr>
<tr><td style="padding:16px 26px 22px;border-top:1px solid #eef0f6;font-size:11.5px;line-height:1.6;color:#8b93a7;">
${altNot ?? "Bu e-postayı beklemiyorsanız görmezden gelebilirsiniz."}
</td></tr>
</table>
</td></tr></table></body></html>`;
}

function dugme(adres: string, metin: string): string {
  return `<p style="margin:0 0 20px;"><a href="${adres}" style="display:inline-block;background:${MARKA};color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:11px 22px;border-radius:10px;">${metin}</a></p>
<p style="margin:0;font-size:12px;line-height:1.6;color:#8b93a7;">Düğme çalışmazsa bu adresi tarayıcınıza yapıştırın:<br><span style="color:${MARKA};word-break:break-all;">${adres}</span></p>`;
}

const p = (metin: string) =>
  `<p style="margin:0 0 16px;font-size:14px;line-height:1.65;color:#3f4757;">${metin}</p>`;

export function dogrulamaSablonu(adres: string) {
  return {
    konu: "TrendMatik — e-posta adresini doğrula",
    html: kabuk(
      "E-posta adresini doğrula",
      p("Hesabını açtığın için teşekkürler. Aşağıdaki düğmeye basarak adresini doğrulayınca oyların ×2 sayılmaya başlar ve liste önerebilirsin.") +
        dugme(adres, "Adresimi doğrula") +
        p("<br>Bağlantı 24 saat geçerlidir."),
      "Bu hesabı sen açmadıysan hiçbir şey yapmana gerek yok."
    ),
    metin: `TrendMatik e-posta doğrulama\n\nAdresini doğrulamak için: ${adres}\n\nBağlantı 24 saat geçerlidir. Bu hesabı sen açmadıysan görmezden gelebilirsin.`,
  };
}

export function sifirlamaSablonu(adres: string) {
  return {
    konu: "TrendMatik — parola sıfırlama",
    html: kabuk(
      "Parolanı sıfırla",
      p("Parolanı sıfırlamak için bir istek aldık. Yeni parolanı belirlemek için aşağıdaki düğmeye bas.") +
        dugme(adres, "Yeni parola belirle") +
        p("<br>Bağlantı 1 saat geçerlidir ve yalnızca bir kez kullanılabilir."),
      "Bu isteği sen yapmadıysan parolan değişmez; e-postayı görmezden gelebilirsin."
    ),
    metin: `TrendMatik parola sıfırlama\n\nYeni parola belirlemek için: ${adres}\n\nBağlantı 1 saat geçerlidir. İsteği sen yapmadıysan görmezden gelebilirsin.`,
  };
}

export function bultenOnaySablonu(adres: string) {
  return {
    konu: "TrendMatik — bülten aboneliğini onayla",
    html: kabuk(
      "Aboneliğini onayla",
      p("Haftalık TrendMatik özetine abone olmak üzeresin: zirve değişimleri, en çok yükselenler ve haftanın listeleri. Haftada bir e-posta, fazlası yok.") +
        dugme(adres, "Aboneliğimi onayla"),
      "Bu isteği sen yapmadıysan hiçbir şey göndermeyeceğiz."
    ),
    metin: `TrendMatik bülten aboneliği\n\nOnaylamak için: ${adres}\n\nİsteği sen yapmadıysan görmezden gelebilirsin.`,
  };
}

export function bultenSablonu(opts: {
  baslik: string;
  satirlar: { baslik: string; metin: string; yol: string }[];
  cikisAdresi: string;
}) {
  const icerik = opts.satirlar
    .map(
      (s) =>
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 12px;border:1px solid #eef0f6;border-radius:10px;">
<tr><td style="padding:14px 16px;">
<a href="${siteUrl()}${s.yol}" style="font-size:14.5px;font-weight:700;color:#16203a;text-decoration:none;">${s.baslik}</a>
<div style="margin-top:5px;font-size:13px;line-height:1.6;color:#5b6478;">${s.metin}</div>
</td></tr></table>`
    )
    .join("");

  return {
    konu: opts.baslik,
    html: kabuk(
      opts.baslik,
      icerik +
        `<p style="margin:18px 0 0;"><a href="${siteUrl()}/hafta" style="font-size:13.5px;font-weight:600;color:${MARKA};text-decoration:none;">Haftanın tamamını gör →</a></p>`,
      `Bu bülteni TrendMatik'e abone olduğun için alıyorsun. <a href="${opts.cikisAdresi}" style="color:#8b93a7;">Abonelikten çık</a>`
    ),
    metin:
      `${opts.baslik}\n\n` +
      opts.satirlar.map((s) => `- ${s.baslik}: ${s.metin}\n  ${siteUrl()}${s.yol}`).join("\n") +
      `\n\nAbonelikten çık: ${opts.cikisAdresi}`,
  };
}
