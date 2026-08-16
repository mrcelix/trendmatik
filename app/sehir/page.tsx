import Link from "next/link";
import type { Metadata } from "next";
import { getSehirler } from "@/lib/db";
import { mutlak, ogTemel } from "@/lib/site";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Şehirler",
  description:
    "Türkiye'nin şehirlerinde trend olanlar — İstanbul, Ankara, İzmir ve diğer şehirlerin topluluk oylamalı sıralamaları.",
  alternates: { canonical: mutlak("/sehir") },
  openGraph: {
    ...(await ogTemel()),
    type: "website",
    title: "Şehirler",
    description: "Şehir şehir trend listeleri.",
    url: mutlak("/sehir"),
  },
};

export default async function SehirlerPage() {
  const sehirler = await getSehirler();

  return (
    <div className="container">
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> › Şehirler
      </div>
      <div className="page-head">
        <h1>📍 Şehirler</h1>
        <span className="sub">{sehirler.length} şehir</span>
      </div>

      {sehirler.length === 0 && (
        <p className="admin-empty">
          Henüz şehir etiketli liste yok. Liste açarken şehir belirtirsen burada görünür.
        </p>
      )}

      <div className="topic-grid">
        {sehirler.map((s) => (
          <Link key={s.slug} href={`/sehir/${s.slug}`} className="topic-card">
            <div className="cat-line">
              <span className="city-tag">{s.sehir}</span>
            </div>
            <h3>{s.sehir}&apos;da trend olanlar</h3>
            <div className="stats">
              <span>📋 {s.listeSayisi} liste</span>
              <span>🗳️ {s.oySayisi.toLocaleString("tr-TR")} oy</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
