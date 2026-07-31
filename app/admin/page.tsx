import Link from "next/link";
import {
  getDenetimKayitlari, getMenuData, getPendingItems, getPendingTopics, getRecentComments,
  getVoteAnomalies,
} from "@/lib/db";

export const dynamic = "force-dynamic";

const sayi = (n: number) => n.toLocaleString("tr-TR");

export default async function AdminDashboard() {
  const [menu, bekleyenBaslik, bekleyenMadde, yorumlar, anomaliler, kayitlar] = await Promise.all([
    getMenuData(),
    getPendingTopics(),
    getPendingItems(),
    getRecentComments(5),
    getVoteAnomalies(),
    getDenetimKayitlari(8),
  ]);

  const s = menu.stats;
  const bekleyenToplam = bekleyenBaslik.length + bekleyenMadde.length;

  return (
    <>
      <div className="page-head">
        <h1>📊 Gösterge Paneli</h1>
        <span className="sub">Sitenin genel durumu</span>
      </div>

      <div className="admin-kartlar">
        <div className="admin-kart">
          <b className="font-num">{sayi(s.listeler)}</b>
          <span>Yayındaki liste</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(s.maddeler)}</b>
          <span>Aktif madde</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(s.oylar)}</b>
          <span>Toplam oy</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(s.bugunOy)}</b>
          <span>Bugünkü oy</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(s.kategoriler)}</b>
          <span>Kategori</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(bekleyenToplam)}</b>
          <span>Onay bekleyen</span>
        </div>
      </div>

      {bekleyenToplam > 0 && (
        <p className="alert-ok" style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {bekleyenToplam} öğe onay bekliyor.
          <Link href="/admin/moderasyon" className="btn btn-sm btn-primary">
            Moderasyona git
          </Link>
        </p>
      )}

      {(anomaliler.heavyVoters.length > 0 || anomaliler.hotGuestItems.length > 0) && (
        <p className="alert-err">
          Son 24 saatte şüpheli oy hareketi var —{" "}
          <Link href="/admin/moderasyon">moderasyon bölümünde incele</Link>.
        </p>
      )}

      <section className="admin-section">
        <h2>Son yorumlar</h2>
        {yorumlar.length === 0 && <p className="admin-empty">Henüz yorum yok.</p>}
        {yorumlar.map((c) => (
          <div className="admin-row" key={c.id}>
            <div className="grow">
              <b>{c.username}</b>
              <span className="dim">
                {" · "}
                <Link href={`/liste/${c.topicSlug}#yorumlar`}>{c.topicTitle}</Link>
              </span>
              <div className="dim">{c.body.slice(0, 120)}</div>
            </div>
          </div>
        ))}
      </section>

      <section className="admin-section">
        <h2>Son yönetim işlemleri</h2>
        {kayitlar.length === 0 && (
          <p className="admin-empty">Henüz kayıt yok. Yaptığın değişiklikler burada listelenir.</p>
        )}
        {kayitlar.map((k) => (
          <div className="admin-row" key={k.id}>
            <div className="grow">
              <b>{k.eylem}</b> <span className="dim">— {k.hedef}</span>
              <div className="dim">
                {k.username} · {new Date(k.created_at * 1000).toLocaleString("tr-TR")}
                {k.detay && ` · ${k.detay}`}
              </div>
            </div>
          </div>
        ))}
      </section>
    </>
  );
}
