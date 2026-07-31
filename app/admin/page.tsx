import Link from "next/link";
import { redirect } from "next/navigation";
import {
  getAllApprovedTopics, getPendingItems, getPendingTopics, getVoteAnomalies,
} from "@/lib/db";
import { getGoogleTrends } from "@/lib/trends";
import { getSessionUser } from "@/lib/auth";
import { adminItemAction, adminTopicAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/giris?e=" + encodeURIComponent("Bu sayfa yöneticilere özeldir."));
  }

  const pendingTopics = await getPendingTopics();
  const pendingItems = await getPendingItems();
  const approved = await getAllApprovedTopics();
  const anomalies = await getVoteAnomalies();
  const trends = await getGoogleTrends();

  return (
    <div className="container">
      <div className="page-head">
        <h1>🛠️ Yönetim Paneli</h1>
        <span className="sub">Onay kuyruğu ve içerik yönetimi</span>
      </div>

      <section className="admin-section">
        <h2>Bekleyen Başlık Önerileri ({pendingTopics.length})</h2>
        {pendingTopics.length === 0 && <p className="admin-empty">Bekleyen başlık yok.</p>}
        {pendingTopics.map((t) => (
          <div className="admin-row" key={t.id}>
            <div className="grow">
              <div>
                <b>{t.title}</b> {t.city && <span className="city-tag">{t.city}</span>}
              </div>
              <div className="dim">
                {t.categoryName} · öneren: {t.suggestedBy ?? "—"} · {t.description || "açıklama yok"}
              </div>
            </div>
            <div className="admin-actions">
              <form action={adminTopicAction}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="op" value="approve" />
                <button className="btn btn-sm btn-primary" type="submit">Onayla</button>
              </form>
              <form action={adminTopicAction}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="op" value="reject" />
                <button className="btn btn-sm btn-danger" type="submit">Reddet</button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="admin-section">
        <h2>Bekleyen Madde Önerileri ({pendingItems.length})</h2>
        {pendingItems.length === 0 && <p className="admin-empty">Bekleyen madde yok.</p>}
        {pendingItems.map((i) => (
          <div className="admin-row" key={i.id}>
            <div className="grow">
              <div><b>{i.name}</b></div>
              <div className="dim">
                başlık: {i.topicTitle} · öneren: {i.suggestedBy ?? "—"}
              </div>
            </div>
            <div className="admin-actions">
              <form action={adminItemAction}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="op" value="candidate" />
                <button className="btn btn-sm btn-primary" type="submit">Aday Yap</button>
              </form>
              <form action={adminItemAction}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="op" value="active" />
                <button className="btn btn-sm" type="submit">Doğrudan Listeye</button>
              </form>
              <form action={adminItemAction}>
                <input type="hidden" name="id" value={i.id} />
                <input type="hidden" name="op" value="reject" />
                <button className="btn btn-sm btn-danger" type="submit">Reddet</button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="admin-section">
        <h2>📈 Gündem Adayları — Google Trends Türkiye</h2>
        {trends.error && <p className="admin-empty">{trends.error}</p>}
        {!trends.error && trends.items.length === 0 && (
          <p className="admin-empty">Beslemede şu an aday yok.</p>
        )}
        {trends.items.map((t, i) => (
          <div className="admin-row" key={i}>
            <div className="grow">
              <b>{t.title}</b>
              {t.traffic && <span className="dim"> · yaklaşık {t.traffic} arama</span>}
            </div>
            <Link
              className="btn btn-sm btn-primary"
              href={`/oner?title=${encodeURIComponent(`${t.title} — Gündem Sıralaması`)}`}
            >
              Başlığa Dönüştür
            </Link>
          </div>
        ))}
        <p className="dim" style={{ fontSize: "0.78rem", marginTop: 6 }}>
          Besleme 30 dakikada bir yenilenir. Yönetici olarak açacağın başlıklar onay beklemeden yayına girer.
        </p>
      </section>

      <section className="admin-section">
        <h2>🚨 Oy Anomalileri (son 24 saat)</h2>
        {anomalies.heavyVoters.length === 0 && anomalies.hotGuestItems.length === 0 && (
          <p className="admin-empty">Şüpheli etkinlik yok.</p>
        )}
        {anomalies.heavyVoters.map((v) => (
          <div className="admin-row" key={v.voter_key}>
            <div className="grow">
              <b>{v.n} oy</b> — <code>{v.voter_key.slice(0, 22)}…</code>
              <span className="dim"> {v.isGuest ? "(misafir)" : "(üye)"}</span>
            </div>
          </div>
        ))}
        {anomalies.hotGuestItems.map((h, i) => (
          <div className="admin-row" key={i}>
            <div className="grow">
              <b>{h.itemName}</b>
              <div className="dim">
                <Link href={`/liste/${h.topicSlug}`}>{h.topicTitle}</Link> · 24 saatte {h.n} misafir oyu
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="admin-section">
        <h2>Yayındaki Başlıklar ({approved.length})</h2>
        {approved.map((t) => (
          <div className="admin-row" key={t.id}>
            <div className="grow">
              <Link href={`/liste/${t.slug}`}><b>{t.title}</b></Link>
              <div className="dim">{t.categoryName}</div>
            </div>
            <form action={adminTopicAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="op" value="reject" />
              <button className="btn btn-sm btn-danger" type="submit">Yayından Kaldır</button>
            </form>
          </div>
        ))}
      </section>
    </div>
  );
}
