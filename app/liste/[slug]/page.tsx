import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getCategories, getCoVotedItems, getComments, getDuelloSayisi, getEloMap,
  getLastWeekChampion, getMyRerank, getRankHistory, getTopicBoard, getTopicBySlug,
  getVotesOfVoterForTopic, GUNLUK_DUELLO_SINIRI, YORUM_MAX, type Donem,
} from "@/lib/db";
import { getSessionUser, getVisitorId } from "@/lib/auth";
import { addCommentAction, hideCommentAction, suggestItemAction } from "@/lib/actions";
import { mutlak, ogTemel } from "@/lib/site";
import VoteButtons from "@/components/VoteButtons";
import ShareButtons from "@/components/ShareButtons";
import RankSparkline from "@/components/RankSparkline";
import RerankPanel from "@/components/RerankPanel";
import DuelWidget from "@/components/DuelWidget";

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
    // Son ek kök layout'taki title.template tarafından ekleniyor
    title: topic.title,
    description: topic.description,
    alternates: { canonical: mutlak(`/liste/${slug}`) },
    openGraph: {
      ...ogTemel(),
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
  searchParams: Promise<{ onerildi?: string; donem?: string; yorumHata?: string }>;
}) {
  const { slug } = await params;
  const { onerildi, donem: donemParam, yorumHata } = await searchParams;
  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") notFound();

  const donem: Donem = DONEMLER.some((d) => d.id === donemParam)
    ? (donemParam as Donem)
    : "tum";

  const category = (await getCategories()).find((c) => c.id === topic.category_id);
  const { top, candidates, rerankKisi } = await getTopicBoard(topic.id, donem);
  const champion = await getLastWeekChampion(topic.id);
  const comments = await getComments(topic.id);
  const gecmis = await getRankHistory(topic.id);
  const yakinlar = await getCoVotedItems(topic.id);

  const user = await getSessionUser();
  const benimSiram = user ? await getMyRerank(user.id, topic.id) : [];
  const vid = await getVisitorId();
  const voterKey = user ? `user-${user.id}` : vid ? `guest-${vid}` : null;
  const myVotes = voterKey
    ? await getVotesOfVoterForTopic(topic.id, voterKey)
    : new Map<number, number>();

  const elo = await getEloMap(topic.id);
  const yapilanDuello = voterKey ? await getDuelloSayisi(topic.id, voterKey) : 0;

  // İlk düello çifti sunucuda seçilir; en az maç yapmış maddeler öncelikli
  const duelloMaddeleri = top.map((i) => ({
    id: i.id,
    name: i.name,
    elo: elo.get(i.id)?.puan ?? 1500,
  }));
  const azMaclilar = [...duelloMaddeleri].sort(
    (a, b) => (elo.get(a.id)?.mac ?? 0) - (elo.get(b.id)?.mac ?? 0)
  );
  const ilkCift: [typeof duelloMaddeleri[0], typeof duelloMaddeleri[0]] | null =
    azMaclilar.length >= 2 ? [azMaclilar[0], azMaclilar[1]] : null;

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
        commentCount: comments.length,
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
              <div className="meta">
                {item.voteCount} oy
                {(elo.get(item.id)?.mac ?? 0) > 0 && ` · ${elo.get(item.id)!.mac} düello`}
              </div>
            </div>
            {(elo.get(item.id)?.mac ?? 0) > 0 && (
              <span className="elo-rozet" title="Elo puanı — ikili karşılaştırmalardan">
                {elo.get(item.id)!.puan}
              </span>
            )}
            <RankSparkline
              gecmis={gecmis.get(item.id) ?? []}
              toplamMadde={top.length}
              ad={item.name}
            />
            <span className="score-pill font-num">{Math.round(item.popScore)}</span>
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

      {/* ---- İkili karşılaştırma ---- */}
      <section className="section" id="duello">
        <div className="section-head">
          <span className="eyebrow">Düello</span>
          <h2>⚔️ İkili karşılaştırma</h2>
          <p>
            Tek soruyla karar ver: hangisi daha çok hak ediyor? Her karşılaştırma maddelerin
            Elo puanını günceller — bu yöntem tek tek oylardan daha güvenilir bir sıralama üretir.
            Üye karşılaştırmaları daha ağır sayılır.
          </p>
        </div>
        <DuelWidget
          slug={topic.slug}
          maddeler={duelloMaddeleri}
          kalanHak={Math.max(0, GUNLUK_DUELLO_SINIRI - yapilanDuello)}
          ilkCift={ilkCift}
        />
      </section>

      {/* ---- Oy yakınlığı ---- */}
      {yakinlar.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="eyebrow">Keşfet</span>
            <h2>Bunu oylayanlar şunları da beğendi</h2>
            <p>Bu listeye oy verenlerin başka listelerde en çok desteklediği maddeler.</p>
          </div>
          <div className="yakin-grid">
            {yakinlar.map((y) => (
              <Link
                key={y.itemId}
                href={`/liste/${y.topicSlug}#madde-${y.itemId}`}
                className="yakin-kart"
              >
                <b>{y.name}</b>
                <small>{y.topicTitle}</small>
                <span className="yakin-sayi font-num">{y.ortakOylayan} ortak oy</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* ---- Kişisel sıralama ---- */}
      <section className="section" id="siralamam">
        <div className="section-head">
          <span className="eyebrow">Senin sıran</span>
          <h2>Kendi sıralamanı yap</h2>
          <p>
            Maddeleri kendi tercihine göre diz. Kişisel sıralamalar tek tek oylardan{" "}
            <b>daha ağır</b> sayılır — çünkü listeyi baştan dizmek daha güçlü bir tercih sinyalidir.
            {rerankKisi > 0 && ` Bu listeyi ${rerankKisi} kişi kendi sırasına göre dizdi.`}
          </p>
        </div>
        {user ? (
          <RerankPanel
            slug={topic.slug}
            maddeler={top.map((i) => ({ id: i.id, name: i.name }))}
            mevcutSira={benimSiram}
          />
        ) : (
          <p className="admin-empty">
            Kendi sıralamanı kaydetmek için <Link href="/giris">giriş yap</Link> veya{" "}
            <Link href="/kayit">üye ol</Link>.
          </p>
        )}
      </section>

      {/* ---- Yorumlar ---- */}
      <section className="comments" id="yorumlar">
        <div className="section-head">
          <span className="eyebrow">Tartışma</span>
          <h2>
            Yorumlar <span className="font-num">({comments.length})</span>
          </h2>
          <p>Sıralamaya katılmıyor musun? Gerekçeni yaz, başkaları da görsün.</p>
        </div>

        {yorumHata && <p className="alert-err">{yorumHata}</p>}

        {comments.length === 0 && (
          <p className="admin-empty">Henüz yorum yok. İlk yorumu sen yaz.</p>
        )}

        <ol className="comment-list">
          {comments.map((c) => (
            <li className="comment" key={c.id}>
              <span className="comment-avatar" aria-hidden="true">
                {c.username.slice(0, 2).toLocaleUpperCase("tr")}
              </span>
              <div className="comment-body">
                <div className="comment-head">
                  <Link href={`/uye/${encodeURIComponent(c.username)}`} className="comment-user">
                    {c.username}
                  </Link>
                  {c.role === "admin" && <span className="comment-rozet">yönetici</span>}
                  <time className="comment-time" dateTime={new Date(c.created_at * 1000).toISOString()}>
                    {new Date(c.created_at * 1000).toLocaleDateString("tr-TR", {
                      day: "numeric",
                      month: "long",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </time>
                  {user && (user.role === "admin" || user.id === c.user_id) && (
                    <form action={hideCommentAction} className="comment-sil">
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="slug" value={topic.slug} />
                      <button type="submit" title="Yorumu kaldır">
                        Kaldır
                      </button>
                    </form>
                  )}
                </div>
                <p className="comment-text">{c.body}</p>
              </div>
            </li>
          ))}
        </ol>

        {user ? (
          <form action={addCommentAction} className="comment-form">
            <input type="hidden" name="slug" value={topic.slug} />
            <textarea
              name="body"
              rows={3}
              maxLength={YORUM_MAX}
              placeholder={`${topic.title} hakkında ne düşünüyorsun?`}
              required
              minLength={2}
              aria-label="Yorumun"
            />
            <div className="comment-form-alt">
              <span className="form-note">En fazla {YORUM_MAX} karakter · saygılı ol</span>
              <button className="btn btn-primary" type="submit">
                Yorum Yap
              </button>
            </div>
          </form>
        ) : (
          <p className="admin-empty">
            Yorum yazmak için <Link href="/giris">giriş yap</Link> veya{" "}
            <Link href="/kayit">üye ol</Link>.
          </p>
        )}
      </section>

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
