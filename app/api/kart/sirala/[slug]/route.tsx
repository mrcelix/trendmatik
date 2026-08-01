import { ImageResponse } from "next/og";
import {
  getMyRerank, getTopicBoard, getTopicBySlug, getUserByUsername, uyumSkoru,
} from "@/lib/db";

/**
 * Kişisel sıralama paylaşım kartı.
 *
 * Topluluk kartından farkı: burada üyenin KENDİ sıralaması ve topluluğun
 * sıralamasıyla uyum skoru var. Paylaşılası olan "listede ne var" değil,
 * "benim sıralamam seninkine ne kadar benziyor".
 *
 * Kullanıcı adı sorgu dizesinden gelir; kişisel sıralamalar zaten
 * profil sayfasında herkese açık.
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const kullanici = new URL(req.url).searchParams.get("u") ?? "";

  const topic = await getTopicBySlug(slug);
  const user = kullanici ? await getUserByUsername(kullanici) : undefined;
  if (!topic || topic.status !== "approved" || !user) {
    return new Response("Bulunamadı", { status: 404 });
  }

  const { top } = await getTopicBoard(topic.id);
  const kisiselIdler = await getMyRerank(user.id, topic.id);
  if (!kisiselIdler.length) return new Response("Sıralama yok", { status: 404 });

  const adlar = new Map(top.map((i) => [Number(i.id), i.name]));
  const topluluk = top.map((i) => Number(i.id));
  const skor = uyumSkoru(kisiselIdler, topluluk);

  const bes = kisiselIdler.slice(0, 5).map((id, i) => ({
    ad: adlar.get(id) ?? "—",
    kisisel: i + 1,
    toplulukSira: topluluk.indexOf(id) + 1,
  }));

  const skorRengi = skor === null ? "#6b7387" : skor >= 70 ? "#15a24a" : skor >= 40 ? "#efa013" : "#e0494e";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg, #ffffff 0%, #f2f4f8 100%)",
          color: "#1a202e", padding: 52, fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 36, fontWeight: 800, display: "flex" }}>
            <span>Trend</span>
            <span style={{ color: "#3a45e0" }}>Matik</span>
          </div>
          <div
            style={{
              display: "flex", fontSize: 22, color: "#3a45e0",
              border: "2px solid #3a45e0", borderRadius: 999, padding: "2px 18px",
            }}
          >
            {user.username} sıraladı
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 40, fontWeight: 700, marginTop: 14, lineHeight: 1.15 }}>
          {topic.title}
        </div>

        <div style={{ display: "flex", gap: 28, marginTop: 24, flex: 1 }}>
          {/* Sıralama */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
            {bes.map((m, i) => (
              <div
                key={i}
                style={{
                  display: "flex", alignItems: "center", gap: 16,
                  background: "#ffffff", border: "1px solid #e4e7ee",
                  borderRadius: 14, padding: "9px 20px", fontSize: i === 0 ? 30 : 25,
                }}
              >
                <span style={{ width: 44, fontWeight: 800, color: "#3a45e0" }}>{m.kisisel}.</span>
                <span style={{ fontWeight: i === 0 ? 700 : 500 }}>{m.ad}</span>
                <span style={{ marginLeft: "auto", color: "#6b7387", fontSize: 20 }}>
                  toplulukta {m.toplulukSira}.
                </span>
              </div>
            ))}
          </div>

          {/* Uyum skoru */}
          <div
            style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", width: 250,
              background: "#ffffff", border: `3px solid ${skorRengi}`,
              borderRadius: 22, padding: 20,
            }}
          >
            <div style={{ display: "flex", fontSize: 20, color: "#6b7387" }}>toplulukla uyum</div>
            <div style={{ display: "flex", fontSize: 88, fontWeight: 800, color: skorRengi, lineHeight: 1.1 }}>
              {skor === null ? "—" : `%${skor}`}
            </div>
            <div style={{ display: "flex", fontSize: 19, color: "#6b7387", textAlign: "center" }}>
              {skor === null
                ? "yeterli madde yok"
                : skor >= 70
                  ? "çoğunlukla aynı fikirdesin"
                  : skor >= 40
                    ? "kısmen ayrışıyorsun"
                    : "tam tersini düşünüyorsun"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 21, color: "#6b7387", marginTop: 14 }}>
          Sen nasıl sıralardın? · trendmatik
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
