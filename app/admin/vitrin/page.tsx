import Link from "next/link";
import { getTopicsAdmin } from "@/lib/db";
import { vitrinAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function VitrinPage() {
  const hepsi = (await getTopicsAdmin()).filter((t) => t.status === "approved");
  const oneCikanlar = hepsi
    .filter((t) => t.one_cikan === 1)
    .sort((a, b) => a.hero_sira - b.hero_sira);
  const digerleri = hepsi.filter((t) => t.one_cikan !== 1);
  const menuDisi = hepsi.filter((t) => t.menude !== 1);

  return (
    <>
      <div className="page-head">
        <h1>✨ Hero & Mega Menü</h1>
        <span className="sub">Ana sayfada ve menüde neyin öne çıkacağını belirle</span>
      </div>

      {/* --- Hero --- */}
      <section className="admin-section">
        <h2>Hero&apos;da öne çıkanlar ({oneCikanlar.length})</h2>
        <p className="form-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Buradaki listeler ana sayfadaki bulucuda en üstte, verdiğin sırayla görünür.
          Hiçbiri seçili değilse bulucu popülerlik sırasını kullanır.
        </p>

        {oneCikanlar.length === 0 && (
          <p className="admin-empty">
            Henüz öne çıkan liste yok — aşağıdan ekleyebilirsin.
          </p>
        )}

        {oneCikanlar.map((t, i) => (
          <div className="admin-row" key={t.id}>
            <span className="rerank-no font-num">{i + 1}</span>
            <div className="grow">
              <b>{t.title}</b>
              <div className="dim">
                {t.categoryName}
                {t.city && ` · ${t.city}`} · {t.oySayisi} oy
              </div>
            </div>
            <div className="admin-actions">
              <form action={vitrinAction} style={{ display: "inline-flex", gap: 4 }}>
                <input type="hidden" name="id" value={t.id} />
                <button className="btn btn-sm" name="islem" value="yukari" disabled={i === 0}>▲</button>
                <button
                  className="btn btn-sm"
                  name="islem"
                  value="asagi"
                  disabled={i === oneCikanlar.length - 1}
                >
                  ▼
                </button>
                <button className="btn btn-sm btn-danger" name="islem" value="hero-kapat">
                  Çıkar
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      <section className="admin-section">
        <h2>Hero&apos;ya eklenebilecekler</h2>
        {digerleri.length === 0 && <p className="admin-empty">Tüm listeler zaten hero&apos;da.</p>}
        {digerleri.map((t) => (
          <div className="admin-row" key={t.id}>
            <div className="grow">
              <b>{t.title}</b>
              <div className="dim">
                {t.categoryName} · {t.oySayisi} oy
              </div>
            </div>
            <form action={vitrinAction}>
              <input type="hidden" name="id" value={t.id} />
              <button className="btn btn-sm btn-primary" name="islem" value="hero-ac">
                Hero&apos;ya ekle
              </button>
            </form>
          </div>
        ))}
      </section>

      {/* --- Mega menü --- */}
      <section className="admin-section">
        <h2>Mega menü</h2>
        <p className="form-note" style={{ marginTop: 0, marginBottom: 12 }}>
          Menüde görünmesini istemediğin listeleri gizleyebilirsin; adresleri çalışmaya devam eder.
          Kategori sırası <Link href="/admin/kategoriler">Kategoriler</Link> bölümünden ayarlanır.
        </p>

        {menuDisi.length > 0 && (
          <>
            <h3 style={{ fontSize: 14, color: "var(--muted)", marginBottom: 8 }}>
              Menüde gizli ({menuDisi.length})
            </h3>
            {menuDisi.map((t) => (
              <div className="admin-row" key={t.id}>
                <div className="grow">
                  <b>{t.title}</b>
                  <div className="dim">{t.categoryName}</div>
                </div>
                <form action={vitrinAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <button className="btn btn-sm btn-primary" name="islem" value="menu-ac">
                    Menüye geri koy
                  </button>
                </form>
              </div>
            ))}
          </>
        )}

        <h3 style={{ fontSize: 14, color: "var(--muted)", margin: "16px 0 8px" }}>
          Menüde görünenler ({hepsi.length - menuDisi.length})
        </h3>
        <div className="admin-tablo-sar">
          <table className="admin-tablo">
            <tbody>
              {hepsi
                .filter((t) => t.menude === 1)
                .map((t) => (
                  <tr key={t.id}>
                    <td>
                      <b>{t.title}</b>
                      <span className="dim"> · {t.categoryName}</span>
                    </td>
                    <td className="sag">
                      <form action={vitrinAction} style={{ display: "inline" }}>
                        <input type="hidden" name="id" value={t.id} />
                        <button className="btn btn-sm" name="islem" value="menu-kapat">
                          Menüden gizle
                        </button>
                      </form>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
