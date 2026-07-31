import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCategories, getLastWeekChampion, getTopicBoard, getTopicBySlug, getVotesOfVoterForTopic,
} from "@/lib/db";
import { getSessionUser, getVisitorId } from "@/lib/auth";
import { suggestItemAction } from "@/lib/actions";
import VoteButtons from "@/components/VoteButtons";

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
    openGraph: {
      title: topic.title,
      description: topic.description,
      images: [`/api/kart/${slug}`],
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
  searchParams: Promise<{ onerildi?: string }>;
}) {
  const { slug } = await params;
  const { onerildi } = await searchParams;
  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") notFound();

  const category = (await getCategories()).find((c) => c.id === topic.category_id);
  const { top, candidates } = await getTopicBoard(topic.id);
  const champion = await getLastWeekChampion(topic.id);

  const user = await getSessionUser();
  const vid = await getVisitorId();
  const voterKey = user ? `user-${user.id}` : vid ? `guest-${vid}` : null;
  const myVotes = voterKey
    ? await getVotesOfVoterForTopic(topic.id, voterKey)
    : new Map<number, number>();

  return (
    <>
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

      <p style={{ marginTop: 10 }}>
        <a className="btn btn-sm" href={`/api/kart/${topic.slug}`} target="_blank">
          🖼️ Paylaşım kartı (PNG)
        </a>{" "}
        <Link className="btn btn-sm" href="/arsiv">🏆 Zirve arşivi</Link>
      </p>

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
    </>
  );
}
