import Link from "next/link";
import type { Metadata } from "next";
import { mutlak, ogTemel } from "@/lib/site";
import {
  currentWeekKey, getMonthlyArchive, getWeeklyArchive, type ChampionRow,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Zirve Arşivi",
  description:
    "TrendMatik'te her haftanın ve ayın 1 numaraları — geçmiş dönemlerin zirvedeki mekan, ürün, konu ve haberleri.",
  alternates: { canonical: mutlak("/arsiv") },
  openGraph: {
    ...(await ogTemel()),
    type: "website",
    title: "Zirve Arşivi",
    description: "Her haftanın ve ayın 1 numaraları.",
    url: mutlak("/arsiv"),
  },
};

const AYLAR = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran",
  "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

function weekLabel(key: string, current: string): string {
  const [y, w] = key.split("-");
  return `${y} · ${Number(w)}. Hafta${key === current ? " (devam ediyor)" : ""}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return `${AYLAR[Number(m) - 1]} ${y}`;
}

function ChampionList({ rows }: { rows: ChampionRow[] }) {
  return (
    <>
      {rows.map((c) => (
        <div className="admin-row" key={`${c.period}-${c.topic_id}`}>
          <span style={{ fontSize: "1.2rem" }}>🏆</span>
          <div className="grow">
            <b>{c.itemName}</b>
            <div className="dim">
              <Link href={`/liste/${c.topicSlug}`}>{c.topicTitle}</Link>
            </div>
          </div>
          <span className="score-pill">{Math.round(c.points)} puan</span>
        </div>
      ))}
    </>
  );
}

export default async function ArchivePage() {
  const weekly = await getWeeklyArchive();
  const monthly = await getMonthlyArchive();
  const curWeek = currentWeekKey();

  const weekKeys = [...weekly.keys()].sort().reverse().slice(0, 8);
  const monthKeys = [...monthly.keys()].sort().reverse().slice(0, 6);

  // Arama motorları için ekmek kırıntısı — sayfanın kendisi dönem listesi
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        name: "Zirve Arşivi",
        url: mutlak("/arsiv"),
        description: "TrendMatik'te her haftanın ve ayın 1 numaraları.",
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: mutlak("/") },
          { "@type": "ListItem", position: 2, name: "Zirve Arşivi", item: mutlak("/arsiv") },
        ],
      },
    ],
  };

  return (
    <div className="container">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="page-head">
        <h1>🏆 Zirve Arşivi</h1>
        <span className="sub">Her dönemin 1 numaraları — tarih yazan sıralamalar</span>
      </div>

      <section className="admin-section">
        <h2>Haftalık Şampiyonlar</h2>
        {weekKeys.length === 0 && <p className="admin-empty">Henüz arşivlenmiş dönem yok.</p>}
        {weekKeys.map((k) => (
          <div key={k} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: "0.95rem", color: "var(--text-dim)", margin: "10px 0 8px" }}>
              {weekLabel(k, curWeek)}
            </h3>
            <ChampionList rows={(weekly.get(k) ?? []).slice(0, 5)} />
          </div>
        ))}
      </section>

      <section className="admin-section">
        <h2>Aylık Şampiyonlar</h2>
        {monthKeys.map((k) => (
          <div key={k} style={{ marginBottom: 18 }}>
            <h3 style={{ fontSize: "0.95rem", color: "var(--text-dim)", margin: "10px 0 8px" }}>
              {monthLabel(k)}
            </h3>
            <ChampionList rows={(monthly.get(k) ?? []).slice(0, 5)} />
          </div>
        ))}
      </section>
    </div>
  );
}
