import { getTopicBoard, getTopicBySlug } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * Başka sitelere gömülmek üzere tasarlanmış minimal liste görünümü.
 *
 * Sayfa değil route handler: kök layout'un üst barı, alt bilgisi, fontları
 * ve betikleri iframe içinde istenmiyor. Stiller satır içi — gömen sitenin
 * CSS'i buraya sızmasın, bizimki de oraya.
 *
 * Sorgu değiştirgeleri: ?tema=gece  ?adet=5
 */

/** HTML'e gömülecek metni kaçırır. */
function kacir(metin: string): string {
  return metin
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sorgu = new URL(req.url).searchParams;
  const topic = await getTopicBySlug(slug);

  const basliklar = {
    "Content-Type": "text/html; charset=utf-8",
    // Herhangi bir sitede çerçevelenebilsin — gömülü olmasının amacı bu
    "Content-Security-Policy": "frame-ancestors *",
    "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=600",
    "X-Robots-Tag": "noindex",
  };

  if (!topic || topic.status !== "approved") {
    return new Response(
      `<!doctype html><meta charset="utf-8"><body style="font:14px system-ui;padding:16px;color:#6b7387">Liste bulunamadı.</body>`,
      { status: 404, headers: basliklar }
    );
  }

  const { top } = await getTopicBoard(topic.id);
  const sayi = Math.max(3, Math.min(10, Number(sorgu.get("adet")) || 10));
  const maddeler = top.slice(0, sayi);
  const gece = sorgu.get("tema") === "gece";

  const r = {
    zemin: gece ? "#0b1120" : "#ffffff",
    kart: gece ? "#141d33" : "#ffffff",
    cizgi: gece ? "#25314f" : "#e6e8f0",
    yazi: gece ? "#e8ecf5" : "#16203a",
    soluk: gece ? "#8b96b0" : "#6b7387",
    marka: "#3a45e0",
    altin: "#efa013",
  };

  const adres = `${siteUrl()}/liste/${topic.slug}`;

  const satirlar = maddeler
    .map(
      (m, i) => `<li style="display:flex;align-items:center;gap:10px;padding:7px 10px;margin-bottom:4px;background:${r.kart};border:1px solid ${r.cizgi};border-radius:8px;font-size:13.5px">
<span style="width:22px;height:22px;flex-shrink:0;display:grid;place-items:center;border-radius:6px;background:${i === 0 ? r.altin : r.cizgi};color:${i === 0 ? "#fff" : r.soluk};font-size:11px;font-weight:700">${m.rank}</span>
<span style="flex:1;min-width:0;font-weight:${i === 0 ? 700 : 500};overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${kacir(m.name)}</span>
<span style="color:${r.soluk};font-size:12px;flex-shrink:0">${Math.round(m.popScore)}</span>
</li>`
    )
    .join("");

  const html = `<!doctype html>
<html lang="tr"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${kacir(topic.title)} — TrendMatik</title>
<style>*{box-sizing:border-box}a{text-decoration:none}a:hover{opacity:.85}</style>
</head>
<body style="margin:0;background:${r.zemin};color:${r.yazi};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:14px">
<a href="${adres}" target="_blank" rel="noopener" style="display:block;font-size:15px;font-weight:700;color:${r.yazi};margin-bottom:10px;line-height:1.3">${kacir(topic.title)}</a>
<ol style="list-style:none;margin:0;padding:0">${satirlar}</ol>
<a href="${adres}" target="_blank" rel="noopener" style="display:flex;align-items:center;justify-content:space-between;margin-top:10px;font-size:11.5px;color:${r.soluk}">
<span>Trend<span style="color:${r.marka};font-weight:700">Matik</span> · topluluk oylamalı</span>
<span style="color:${r.marka};font-weight:600">oy ver →</span>
</a>
</body></html>`;

  return new Response(html, { headers: basliklar });
}
