import { ImageResponse } from "next/og";
import { getTopicBoard, getTopicBySlug } from "@/lib/db";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") {
    return new Response("Bulunamadı", { status: 404 });
  }
  const { top } = await getTopicBoard(topic.id);
  const five = top.slice(0, 5);
  const medal = ["🥇", "🥈", "🥉", "4.", "5."];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%", height: "100%", display: "flex", flexDirection: "column",
          background: "linear-gradient(135deg, #ffffff 0%, #f2f4f8 100%)",
          color: "#1a202e", padding: 56, fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontSize: 40, fontWeight: 800, display: "flex" }}>
            <span>Trend</span>
            <span style={{ color: "#ff6154" }}>Matik</span>
          </div>
          {topic.city && (
            <div
              style={{
                display: "flex", fontSize: 24, color: "#ff6154", border: "2px solid #ff6154",
                borderRadius: 999, padding: "2px 18px",
              }}
            >
              {topic.city}
            </div>
          )}
        </div>
        <div style={{ display: "flex", fontSize: 46, fontWeight: 700, marginTop: 18, lineHeight: 1.15 }}>
          {topic.title}
        </div>
        <div style={{ display: "flex", flexDirection: "column", marginTop: 30, gap: 14 }}>
          {five.map((item, i) => (
            <div
              key={item.id}
              style={{
                display: "flex", alignItems: "center", gap: 20,
                background: "#ffffff", border: "1px solid #e4e7ee",
                borderRadius: 16, padding: "10px 24px",
                fontSize: i === 0 ? 34 : 28,
              }}
            >
              <span style={{ width: 56 }}>{medal[i]}</span>
              <span style={{ fontWeight: i === 0 ? 700 : 500 }}>{item.name}</span>
              <span style={{ marginLeft: "auto", color: "#6b7387", fontSize: 24 }}>
                {Math.round(item.popScore)} puan
              </span>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", marginTop: "auto", fontSize: 22, color: "#6b7387" }}>
          Sıralamayı sen belirle — oyunu kullan · trendmatik
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
