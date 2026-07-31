import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCategories, getLastWeekChampion, getTopicBoard, getTopicBySlug, getVotesOfVoterForTopic,
  type Donem,
} from "@/lib/db";
import { getSessionUser, getVisitorId } from "@/lib/auth";
import { suggestItemAction } from "@/lib/actions";
import { mutlak } from "@/lib/site";
import VoteButtons from "@/components/VoteButtons";
import ShareButtons from "@/components/ShareButtons";

const DONEMLER: { id: Donem; ad: string }[] = [
  { id: "tum", ad: "Tüm zamanlar" },
  { id: "ay", ad: "Bu ay" },
  { id: "hafta", ad: "Bu hafta" },
  { id: "gun", ad: "Bugün" },
];

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const topic = await getTopicBySlug(slug);
  if (!topic) return {};
  return {
    title: `${topic.title} — TrendMatik`,
    description: topic.description,
    alternates: { canonical: mutlak(`/liste/${slug}`) },
    openGraph: {
      type: "article",
      title: topic.title,
      description: topic.description,
      url: mutlak(`/liste/${slug}`),
      images: [{ url: mutlak(`/api/kart/${slug}`), width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: topic.title,
      description: topic.description,
      images: [mutlak(`/api/kart/${slug}`)],
    },
  };
}

function Delta({ delta }: { delta: number | null }) {
  if (delta === null) return <span className="delta new">YENİ</span>;
  if (delta > 0) return <span className="delta up">▲ {delta}</span>;
  if (delta < 0) return <span className="delta down">▼ {-delta}</span>;
  return <span className="delta same">—</span>;
}

export default async function TopicPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ onerildi?: string; donem?: string }>;
}) {
  const { slug } = await params;
  const { onerildi, donem: donemParam } = await searchParams;
  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") notFound();

  const donem: Donem = DONEMLER.some((d) => d.id === donemParam)
    ? (donemParam as Donem)
    : "tum";

  const category = (await getCategories()).find((c) => c.id === topic.category_id);
  const { top, candidates } = await getTopicBoard(topic.id, donem);
  const champion = await getLastWeekChampion(topic.id);

  const user = await getSessionUser();
  const vid = await getVisitorId();
  const voterKey = user ? `user-${user.id}` : vid ? `guest-${vid}` : null;
  const myVotes = voterKey
    ? await getVotesOfVoterForTopic(topic.id, voterKey)
    : new Map<number, number>();

  // Arama motorları için yapılandırılmış veri (sıralama + ekmek kırıntısı)
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "ItemList",
        name: topic.title,
        description: topic.description,
        url: mutlak(`/liste/${topic.slug}`),
        numberOfItems: top.length,
        itemListOrder: "https://schema.org/ItemListOrderDescending",
        itemListElement: top.map((item) => ({
          "@type": "ListItem",
          position: item.rank,
          name: item.name,
          url: mutlak(`/liste/${topic.slug}#madde-${item.id}`),
        })),
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Ana Sayfa", item: mutlak("/") },
          ...(category
            ? [
                {
                  "@type": "ListItem",
                  position: 2,
                  name: category.name,
                  item: mutlak(`/kategori/${category.slug}`),
                },
              ]
            : []),
          {
            "@type": "ListItem",
            position: category ? 3 : 2,
            name: topic.title,
            item: mutlak(`/liste/${topic.slug}`),
          },
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
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> ›{" "}
        {category && <Link href={`/kategori/${category.slug}`}>{category.name}</Link>} › {topic.title}
      </div>
      <div className="page-head">
        <h1>{topic.title}</h1>
        {topic.city && <span className="city-tag">{topic.city}</span>}
      </div>
      <p className="sub" style={{ color: "var(--text-dim)", fontSize: "0.9rem" }}>
        {topic.description} — Sıralamayı oylar belirler; ▲▼ düne göre değişimi gösterir.
        {!user && " Üye olursan oyun ×2 sayılır."}
      </p>

      <ShareButtons
        url={mutlak(`/liste/${topic.slug}`)}
        title={topic.title}
        cardUrl={`/api/kart/${topic.slug}`}
      />

      <div className="tabs" role="group" aria-label="Zaman aralığı">
        {DONEMLER.map((d) => (
          <Link
            key={d.id}
            href={d.id === "tum" ? `/liste/${topic.slug}` : `/liste/${topic.slug}?donem=${d.id}`}
            className={`tab ${donem === d.id ? "active" : ""}`}
          >
            {d.ad}
          </Link>
        ))}
      </div>

      {onerildi && (
        <p className="alert-ok" style={{ marginTop: 12 }}>
          Önerin alındı! Yönetici onayından sonra aday listesinde görünecek.
        </p>
      )}

      <div className="board">
        {top.map((item) => (
          <div className="board-row" key={item.id} id={`madde-${item.id}`}>
            <span className="rank-no">{item.rank}</span>
            <Delta delta={item.delta} />
            <div className="row-main">
              <div className="name">
                {item.name}
                {champion?.itemName === item.name && (
                  <span title="Geçen haftanın 1 numarası" style={{ marginLeft: 6 }}>🏆</span>
                )}
              </div>
              <div className="meta">{item.voteCount} oy</div>
            </div>
            <span className="score-pill">{Math.round(item.popScore)}</span>
            <VoteButtons itemId={item.id} myVote={myVotes.get(item.id)} />
          </div>
        ))}
      </div>

      {candidates.length > 0 && (
        <section className="candidates">
          <h3>🚀 Aday maddeler — yeterli desteği toplayan Top 10'a girer</h3>
          {candidates.map((item) => (
            <div className="candidate-row" key={item.id}>
              <div className="name">{item.name}</div>
              <span className="score-pill">{Math.round(item.popScore)}</span>
              <VoteButtons itemId={item.id} myVote={myVotes.get(item.id)} />
            </div>
          ))}
        </section>
      )}

      <section className="form-card wide" style={{ margin: "10px 0 30px" }}>
        <h1 style={{ fontSize: "1.05rem" }}>Listede eksik olan mı var?</h1>
        {user ? (
          <form action={suggestItemAction}>
            <input type="hidden" name="slug" value={topic.slug} />
            <div className="field">
              <label htmlFor="name">Madde adı</label>
              <input id="name" name="name" placeholder="Örn: Yeni açılan mekan…" required minLength={2} />
            </div>
            <button className="btn btn-primary" type="submit">Öner (admin onayına gider)</button>
          </form>
        ) : (
          <p className="form-note">
            Madde önermek için <Link href="/giris" style={{ color: "var(--accent)" }}>giriş yap</Link> veya{" "}
            <Link href="/kayit" style={{ color: "var(--accent)" }}>üye ol</Link>.
          </p>
        )}
      </section>
    </div>
  );
}
