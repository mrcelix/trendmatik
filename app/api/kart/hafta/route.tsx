import { ImageResponse } from "next/og";
import { getHaftalikOzet } from "@/lib/db";

/** Haftalık özetin paylaşım kartı — her hafta içeriğiyle birlikte değişir. */
export async function GET() {
  const o = await getHaftalikOzet();
  const sayi = (n: number) => n.toLocaleString("tr-TR");

  const tarih = (g: string) =>
    new Date(`${g}T12:00:00Z`).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });

  const oneCikan = o.zirveDegisenler[0];
  const enHizli = o.yukselenler[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(165deg, #16203a 0%, #1e2b4d 100%)",
          color: "#fff",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ display: "flex", fontSize: 34, fontWeight: 800 }}>
            <span>Trend</span>
            <span style={{ color: "#efa013" }}>Matik</span>
          </div>
          <div
            style={{
              display: "flex",
              border: "2px solid rgba(255,255,255,0.2)",
              borderRadius: 999,
              padding: "4px 18px",
              fontSize: 22,
              color: "#c7cee8",
            }}
          >
            {tarih(o.baslangic)} – {tarih(o.bitis)}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 56, fontWeight: 800, marginTop: 14, lineHeight: 1.1 }}>
          Bu hafta TrendMatik&apos;te
        </div>

        {/* Haftanın öne çıkan iki olayı */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 26 }}>
          {oneCikan && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "14px 22px",
                fontSize: 27,
              }}
            >
              <span>👑</span>
              <span style={{ color: "#7df9c4", fontWeight: 700 }}>{oneCikan.yeni}</span>
              <span style={{ color: "#b6bedc" }}>zirveye çıktı</span>
            </div>
          )}
          {enHizli && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: "rgba(255,255,255,0.07)",
                borderRadius: 16,
                padding: "14px 22px",
                fontSize: 27,
              }}
            >
              <span>🚀</span>
              <span style={{ color: "#ffd264", fontWeight: 700 }}>{enHizli.ad}</span>
              <span style={{ color: "#b6bedc" }}>
                {enHizli.fark} sıra yükseldi
              </span>
            </div>
          )}
        </div>

        {/* Hafta sayaçları */}
        <div style={{ display: "flex", gap: 40, marginTop: "auto" }}>
          {[
            [sayi(o.sayilar.oy), "oy"],
            [sayi(o.sayilar.duello), "düello"],
            [sayi(o.sayilar.tahmin), "tahmin"],
            [sayi(o.sayilar.yorum), "yorum"],
          ].map(([deger, etiket]) => (
            <div key={etiket} style={{ display: "flex", flexDirection: "column" }}>
              <span style={{ fontSize: 44, fontWeight: 800 }}>{deger}</span>
              <span style={{ fontSize: 22, color: "#8c96b8" }}>{etiket}</span>
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
