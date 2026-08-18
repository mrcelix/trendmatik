import {
  getDenetimKayitlari, getHeroMetinleri, getSettings, getSiteMetinleri,
  HERO_KELIME_SAYISI, SERIT_YERTUTUCU,
} from "@/lib/db";
import {
  ayarKaydetAction, duyuruAction, heroMetinAction, heroMetinSifirlaAction,
  siteMetinAction, siteMetinSifirlaAction,
} from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AyarlarPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { ok, e } = await searchParams;
  const [ayarlar, kayitlar, hero, metin] = await Promise.all([
    getSettings(),
    getDenetimKayitlari(60),
    getHeroMetinleri(),
    getSiteMetinleri(),
  ]);
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

      {/* --- Hero metinleri --- */}
      <section className="admin-section">
        <h2>Ana sayfa hero metinleri</h2>
        <p className="form-note" style={{ marginTop: 0 }}>
          Ana sayfanın en üstündeki tanıtım yazıları. Boş bıraktığınız alan
          varsayılana döner. Değişiklik anında yayına girer.
        </p>

        <form action={heroMetinAction} className="admin-form">
          <div className="field">
            <label htmlFor="baslik">Başlık (1. satır)</label>
            <input id="baslik" name="baslik" defaultValue={hero.baslik} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="vurgu">Vurgu satırı (2. satır, renkli)</label>
            <input id="vurgu" name="vurgu" defaultValue={hero.vurgu} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="kelimeler">
              Dönen kelimeler — her satıra bir tane, tam {HERO_KELIME_SAYISI} adet
            </label>
            <textarea
              id="kelimeler"
              name="kelimeler"
              rows={HERO_KELIME_SAYISI}
              defaultValue={hero.kelimeler.join("\n")}
            />
          </div>
          <div className="field">
            <label htmlFor="aciklama">Açıklama paragrafı</label>
            <textarea id="aciklama" name="aciklama" rows={3} defaultValue={hero.aciklama} maxLength={400} />
          </div>
          <div className="field">
            <label htmlFor="rozetler">Rozetler — her satıra bir tane, en çok 6</label>
            <textarea id="rozetler" name="rozetler" rows={3} defaultValue={hero.rozetler.join("\n")} />
          </div>
          <div className="admin-form-satir" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" type="submit">Hero metinlerini kaydet</button>
          </div>
          <p className="form-note">
            Kelime sayısı {HERO_KELIME_SAYISI}&apos;te sabit: animasyon döngünün dörtte
            birini her kelimeye ayırıyor, sayı değişirse ritim bozulur. Eksik bıraktığınız
            slot varsayılana düşer, fazlası yok sayılır. Başlığın sonundaki
            &quot;gör.&quot; kelimesi tasarımın parçası, sabit.
          </p>
        </form>

        <form action={heroMetinSifirlaAction} style={{ marginTop: 10 }}>
          <button className="btn btn-sm" type="submit">Varsayılan metinlere dön</button>
        </form>
      </section>

      {/* --- Şerit ve alt bilgi metinleri --- */}
      <section className="admin-section">
        <h2>Üst şerit ve alt bilgi</h2>
        <p className="form-note" style={{ marginTop: 0 }}>
          Başlığın altındaki kayan şerit ile alt bilgideki tanıtım yazıları.
          Boş bıraktığınız alan varsayılana döner.
        </p>

        <form action={siteMetinAction} className="admin-form">
          <div className="field">
            <label htmlFor="serit">Kayan şerit — her satıra bir öğe, en çok 10</label>
            <textarea id="serit" name="serit" rows={6} defaultValue={metin.serit.join("\n")} />
          </div>
          <p className="form-note" style={{ marginTop: 0 }}>
            Sayılar otomatik yerleşir; yer tutucuları kullanın:{" "}
            {SERIT_YERTUTUCU.map((y) => (
              <code key={y} style={{ marginRight: 6 }}>{y}</code>
            ))}
            — sırasıyla liste, oy, bugünkü oy, kategori ve madde sayısı.
          </p>

          <div className="field">
            <label htmlFor="bultenBaslik">Alt bilgi — bülten kutusu başlığı</label>
            <input id="bultenBaslik" name="bultenBaslik" defaultValue={metin.bultenBaslik} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="bultenMetin">Alt bilgi — bülten kutusu metni</label>
            <textarea id="bultenMetin" name="bultenMetin" rows={2} defaultValue={metin.bultenMetin} maxLength={300} />
          </div>
          <div className="field">
            <label htmlFor="altbilgiTanim">Alt bilgi — site adının yanındaki tanım</label>
            <input id="altbilgiTanim" name="altbilgiTanim" defaultValue={metin.altbilgiTanim} maxLength={120} />
          </div>
          <div className="field">
            <label htmlFor="altbilgiKural">Alt bilgi — sağdaki kural satırı</label>
            <input id="altbilgiKural" name="altbilgiKural" defaultValue={metin.altbilgiKural} maxLength={160} />
          </div>

          <div className="admin-form-satir" style={{ marginTop: 8 }}>
            <button className="btn btn-primary" type="submit">Metinleri kaydet</button>
          </div>
        </form>

        <form action={siteMetinSifirlaAction} style={{ marginTop: 10 }}>
          <button className="btn btn-sm" type="submit">Varsayılan metinlere dön</button>
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
