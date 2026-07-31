import { getCategoriesAdmin } from "@/lib/db";
import { kategoriEkleAction, kategoriGuncelleAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function KategorilerPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { ok, e } = await searchParams;
  const kategoriler = await getCategoriesAdmin();

  return (
    <>
      <div className="page-head">
        <h1>🗂️ Kategoriler</h1>
        <span className="sub">{kategoriler.length} kategori</span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <form action={kategoriEkleAction} className="admin-form">
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="ad">Yeni kategori adı</label>
            <input id="ad" name="ad" placeholder="Örn: Etkinlik" required minLength={2} maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="emoji">Simge</label>
            <input id="emoji" name="emoji" placeholder="🎪" maxLength={4} />
          </div>
          <button className="btn btn-primary" type="submit">Kategori Ekle</button>
        </div>
      </form>

      <div className="admin-tablo-sar">
        <table className="admin-tablo">
          <thead>
            <tr>
              <th>Sıra</th>
              <th>Kategori</th>
              <th>Adres</th>
              <th>Liste</th>
              <th>Durum</th>
              <th className="sag">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {kategoriler.map((k, i) => (
              <tr key={k.id}>
                <td>
                  <form action={kategoriGuncelleAction} style={{ display: "inline-flex", gap: 4 }}>
                    <input type="hidden" name="id" value={k.id} />
                    <button className="btn btn-sm" name="islem" value="yukari" disabled={i === 0} title="Yukarı">
                      ▲
                    </button>
                    <button
                      className="btn btn-sm"
                      name="islem"
                      value="asagi"
                      disabled={i === kategoriler.length - 1}
                      title="Aşağı"
                    >
                      ▼
                    </button>
                  </form>
                </td>
                <td>
                  <form action={kategoriGuncelleAction} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                    <input type="hidden" name="id" value={k.id} />
                    <input
                      name="emoji"
                      defaultValue={k.emoji}
                      maxLength={4}
                      style={{ width: 54, height: 32 }}
                      aria-label="Simge"
                    />
                    <input
                      name="ad"
                      defaultValue={k.name}
                      maxLength={40}
                      style={{ height: 32 }}
                      aria-label="Kategori adı"
                    />
                    <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, whiteSpace: "nowrap" }}>
                      <input type="checkbox" name="aktif" defaultChecked={k.aktif === 1} style={{ width: "auto", height: "auto" }} />
                      aktif
                    </label>
                    <button className="btn btn-sm btn-primary" name="islem" value="kaydet" type="submit">
                      Kaydet
                    </button>
                  </form>
                </td>
                <td className="dim">/kategori/{k.slug}</td>
                <td className="font-num">{k.listeSayisi}</td>
                <td>
                  {k.aktif === 1 ? (
                    <span className="badge-hot" style={{ background: "var(--up-soft)", color: "var(--up)" }}>
                      Yayında
                    </span>
                  ) : (
                    <span className="badge-hot">Gizli</span>
                  )}
                </td>
                <td className="sag">
                  <form action={kategoriGuncelleAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={k.id} />
                    <button className="btn btn-sm btn-danger" name="islem" value="sil" type="submit">
                      Sil
                    </button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="form-note">
        Kategori silmek yalnızca içinde liste yoksa mümkündür. Gizlenen kategoriler menüde ve
        ana sayfada görünmez ama adresleri çalışmaya devam eder.
      </p>
    </>
  );
}
