import { getDenetimKayitlari, getSettings } from "@/lib/db";
import { ayarKaydetAction, duyuruAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AyarlarPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { ok, e } = await searchParams;
  const [ayarlar, kayitlar] = await Promise.all([getSettings(), getDenetimKayitlari(60)]);
  const acik = (k: string, varsayilan = true) =>
    ayarlar[k] === undefined ? varsayilan : ayarlar[k] === "on" || ayarlar[k] === "1";

  return (
    <>
      <div className="page-head">
        <h1>⚙️ Ayarlar & Kayıtlar</h1>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <section className="admin-section">
        <h2>Site ayarları</h2>
        <form action={ayarKaydetAction} className="admin-form">
          <div className="field">
            <label htmlFor="site_adi">Site adı</label>
            <input id="site_adi" name="site_adi" defaultValue={ayarlar.site_adi ?? "TrendMatik"} maxLength={60} />
          </div>
          <div className="field">
            <label htmlFor="site_aciklama">Site açıklaması</label>
            <input
              id="site_aciklama"
              name="site_aciklama"
              defaultValue={ayarlar.site_aciklama ?? ""}
              placeholder="Arama sonuçlarında görünen kısa açıklama"
              maxLength={200}
            />
          </div>
          <div className="admin-form-satir" style={{ marginTop: 8 }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="duello_acik" defaultChecked={acik("duello_acik")} style={{ width: "auto" }} />
              Düello (ikili karşılaştırma) açık
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="yorum_acik" defaultChecked={acik("yorum_acik")} style={{ width: "auto" }} />
              Yorumlar açık
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="oneri_acik" defaultChecked={acik("oneri_acik")} style={{ width: "auto" }} />
              Üye önerileri açık
            </label>
            <button className="btn btn-primary" type="submit">Ayarları Kaydet</button>
          </div>
          <p className="form-note">
            Kapatılan bölüm hem arayüzden kalkar hem de sunucu tarafında reddedilir;
            doğrudan gönderilen istekler de çalışmaz. <b>Düello</b> liste sayfasındaki
            ikili karşılaştırma kutusu, <b>yorumlar</b> liste altındaki yorum bölümü,
            <b> üye önerileri</b> ise &quot;Başlık Öner&quot; sayfası ve liste
            sayfasındaki madde önerme kutusudur. Öneriler kapalıyken yöneticiler
            başlık eklemeye devam edebilir. Site adı ve açıklaması sayfa başlığı,
            arama sonuçları ve paylaşım kartlarında kullanılır.
          </p>
        </form>
      </section>

      <section className="admin-section">
        <h2>Tüm üyelere duyuru</h2>
        <form action={duyuruAction} className="admin-form">
          <div className="field">
            <label htmlFor="mesaj">Duyuru metni</label>
            <input id="mesaj" name="mesaj" placeholder="Örn: Yeni düello özelliği yayında!" required minLength={5} maxLength={200} />
          </div>
          <div className="admin-form-satir">
            <div className="field">
              <label htmlFor="link">Bağlantı</label>
              <input id="link" name="link" defaultValue="/" maxLength={200} />
            </div>
            <button className="btn btn-primary" type="submit">Duyuruyu Gönder</button>
          </div>
          <p className="form-note">
            Askıya alınmamış tüm üyelere site içi bildirim olarak düşer. Geri alınamaz.
          </p>
        </form>
      </section>

      <section className="admin-section">
        <h2>Yönetim kayıtları ({kayitlar.length})</h2>
        <p className="form-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Kim, neyi, ne zaman değiştirdi. Yanlış bir değişikliği geri izlemek için.
        </p>
        <div className="admin-tablo-sar">
          <table className="admin-tablo">
            <thead>
              <tr>
                <th>Zaman</th>
                <th>Kim</th>
                <th>Eylem</th>
                <th>Hedef</th>
              </tr>
            </thead>
            <tbody>
              {kayitlar.map((k) => (
                <tr key={k.id}>
                  <td className="dim">{new Date(k.created_at * 1000).toLocaleString("tr-TR")}</td>
                  <td>{k.username}</td>
                  <td><b>{k.eylem}</b></td>
                  <td className="dim">
                    {k.hedef}
                    {k.detay && ` — ${k.detay.slice(0, 60)}`}
                  </td>
                </tr>
              ))}
              {kayitlar.length === 0 && (
                <tr><td colSpan={4} className="dim">Henüz kayıt yok.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
