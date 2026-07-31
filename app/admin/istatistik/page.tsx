import { getIstatistik, getMenuData } from "@/lib/db";

export const dynamic = "force-dynamic";

const sayi = (n: number) => n.toLocaleString("tr-TR");

export default async function IstatistikPage() {
  const [ist, menu] = await Promise.all([getIstatistik(14), getMenuData()]);
  const enYuksek = Math.max(1, ...ist.gunluk.map((g) => g.goruntuleme));

  return (
    <>
      <div className="page-head">
        <h1>📈 İstatistikler</h1>
        <span className="sub">Son 14 gün</span>
      </div>

      <div className="admin-kartlar">
        <div className="admin-kart">
          <b className="font-num">{sayi(ist.toplamGoruntuleme)}</b>
          <span>Sayfa görüntüleme</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(ist.toplamTiklama)}</b>
          <span>Tıklama</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(ist.tekilZiyaretci)}</b>
          <span>Tekil ziyaretçi</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(menu.stats.oylar)}</b>
          <span>Toplam oy</span>
        </div>
        <div className="admin-kart">
          <b className="font-num">{sayi(menu.stats.bugunOy)}</b>
          <span>Bugünkü oy</span>
        </div>
      </div>

      <section className="admin-section">
        <h2>Günlük hareket</h2>
        {ist.gunluk.length === 0 ? (
          <p className="admin-empty">
            Henüz veri yok. Ziyaretçiler siteyi gezdikçe burası dolacak — yönetim sayfaları sayılmaz.
          </p>
        ) : (
          <div className="ist-grafik">
            {ist.gunluk.map((g) => (
              <div className="ist-sutun" key={g.gun} title={`${g.gun}: ${g.goruntuleme} görüntüleme, ${g.tiklama} tıklama`}>
                <span
                  className="ist-cubuk"
                  style={{ height: `${Math.round((g.goruntuleme / enYuksek) * 100)}%` }}
                />
                <span
                  className="ist-cubuk ist-tiklama"
                  style={{ height: `${Math.round((g.tiklama / enYuksek) * 100)}%` }}
                />
                <small>{g.gun.slice(8)}</small>
              </div>
            ))}
          </div>
        )}
        <p className="form-note">
          Koyu çubuk sayfa görüntüleme, açık çubuk tıklama. Gün numaraları ayın günüdür.
        </p>
      </section>

      <div className="admin-form-satir" style={{ alignItems: "start", gap: 20 }}>
        <section className="admin-section" style={{ margin: 0 }}>
          <h2>En çok görüntülenen sayfalar</h2>
          {ist.enCokSayfa.length === 0 && <p className="admin-empty">Veri yok.</p>}
          {ist.enCokSayfa.map((s) => (
            <div className="admin-row" key={s.yol}>
              <div className="grow"><code>{s.yol}</code></div>
              <b className="font-num">{sayi(s.n)}</b>
            </div>
          ))}
        </section>

        <section className="admin-section" style={{ margin: 0 }}>
          <h2>En çok tıklanan bağlantılar</h2>
          {ist.enCokTiklama.length === 0 && <p className="admin-empty">Veri yok.</p>}
          {ist.enCokTiklama.map((s) => (
            <div className="admin-row" key={s.hedef}>
              <div className="grow"><code>{s.hedef}</code></div>
              <b className="font-num">{sayi(s.n)}</b>
            </div>
          ))}
        </section>
      </div>
    </>
  );
}
