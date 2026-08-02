import Link from "next/link";
import { getCategories, getTopicsAdmin } from "@/lib/db";
import { vitrinAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Mega menü kategori başına bu kadar liste gösteriyor (bkz. getMenuData). */
const MENU_LIMIT = 12;

export default async function AdminMenuPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string; q?: string; kategori?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const acikKategori = sp.kategori ?? "";

  const [hepsiHam, kategoriler] = await Promise.all([getTopicsAdmin(), getCategories()]);
  const hepsi = hepsiHam.filter((t) => t.status === "approved");

  const norm = (s: string) =>
    s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) =>
      ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c
    );
  const terim = norm(q);

  // Kategori kategori grupla: 600 listeyi tek yığın hâlinde göstermek
  // yönetilebilir değildi.
  const gruplar = kategoriler.map((k) => {
    const listeler = hepsi
      .filter((t) => t.categorySlug === k.slug)
      .filter((t) => !terim || norm(t.title).includes(terim))
      .sort((a, b) => b.oySayisi - a.oySayisi);
    return {
      kategori: k,
      listeler,
      gorunen: listeler.filter((t) => t.menude === 1).length,
      gizli: listeler.filter((t) => t.menude !== 1).length,
    };
  });

  const toplamGizli = hepsi.filter((t) => t.menude !== 1).length;

  // İşlem sonrası aynı görünüme dönülsün: açık kategori ve arama korunur
  const donusAdresi = (() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (acikKategori) p.set("kategori", acikKategori);
    return `/admin/menu${p.size ? `?${p}` : ""}`;
  })();

  return (
    <>
      <div className="page-head">
        <h1>🗂️ Mega Menü</h1>
        <span className="sub">
          {hepsi.length - toplamGizli} liste menüde · {toplamGizli} gizli
        </span>
      </div>

      {sp.ok && <p className="alert-ok">{sp.ok}</p>}
      {sp.e && <p className="alert-err">{sp.e}</p>}

      <p className="form-note" style={{ marginTop: 0 }}>
        Menüden gizlenen listeler <b>silinmez</b>; adresleri ve kategori sayfaları
        çalışmaya devam eder, yalnızca üst bardaki menüde görünmezler.
      </p>
      <p className="form-note" style={{ marginTop: 0 }}>
        Menü panelinde kategori başına <b>en popüler {MENU_LIMIT} liste</b> gösterilir,
        altına &quot;+N liste daha&quot; bağlantısı konur. Yani bir listeyi menüde
        görünür yapmak onu panelde göstermeyi garanti etmez — sıralamada ilk
        {" "}{MENU_LIMIT} içine girmesi gerekir. Kategori sırası{" "}
        <Link href="/admin/kategoriler">Kategoriler</Link>, hero ayarları{" "}
        <Link href="/admin/hero">Hero Alanı</Link> bölümünde.
      </p>

      <form className="admin-form" style={{ marginBottom: 12 }}>
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="q">Liste ara</label>
            <input id="q" name="q" defaultValue={q} placeholder="Başlıkta ara…" />
          </div>
          {acikKategori && <input type="hidden" name="kategori" value={acikKategori} />}
          <button className="btn btn-primary" type="submit">Süz</button>
          {q && <Link href="/admin/menu" className="btn">Temizle</Link>}
        </div>
      </form>

      {gruplar.map((g) => {
        const acik = acikKategori === g.kategori.slug;
        const panelde = g.listeler.filter((t) => t.menude === 1).slice(0, MENU_LIMIT);
        const kesilen = g.gorunen - panelde.length;

        return (
          <section className="admin-section" key={g.kategori.id}>
            <div className="menu-kategori-basi">
              <h2 style={{ margin: 0 }}>
                {g.kategori.emoji} {g.kategori.name}
              </h2>
              <span className="dim" style={{ fontSize: 12.5 }}>
                {g.gorunen} menüde
                {g.gizli > 0 && ` · ${g.gizli} gizli`}
                {kesilen > 0 && ` · panelde ilk ${MENU_LIMIT}, ${kesilen} tanesi "daha fazla" altında`}
              </span>
              <span className="menu-kategori-eylem">
                <form action={vitrinAction} style={{ display: "inline-flex", gap: 6 }}>
                  <input type="hidden" name="kategori" value={g.kategori.slug} />
                  <input type="hidden" name="donus" value={donusAdresi} />
                  <button className="btn btn-sm" name="islem" value="menu-kategori-ac" disabled={g.gizli === 0}>
                    Tümünü göster
                  </button>
                  <button className="btn btn-sm" name="islem" value="menu-kategori-kapat" disabled={g.gorunen === 0}>
                    Tümünü gizle
                  </button>
                </form>
                <Link
                  href={acik ? "/admin/menu" : `/admin/menu?kategori=${g.kategori.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
                  className="btn btn-sm"
                >
                  {acik ? "Kapat" : `Listeleri gör (${g.listeler.length})`}
                </Link>
              </span>
            </div>

            {/* Panelde görünecek ilk 12 — kullanıcının göreceği hâli */}
            {panelde.length > 0 && (
              <div className="menu-onizleme">
                <span className="menu-onizleme-etiket">Panelde görünen sıra:</span>
                {panelde.map((t, i) => (
                  <span className="menu-onizleme-oge" key={t.id}>
                    <b>{i + 1}.</b> {t.title}
                  </span>
                ))}
              </div>
            )}

            {acik && (
              <div className="admin-tablo-sar" style={{ marginTop: 10 }}>
                <table className="admin-tablo">
                  <thead>
                    <tr>
                      <th>Liste</th>
                      <th style={{ width: 80 }}>Oy</th>
                      <th style={{ width: 110 }}>Durum</th>
                      <th className="sag" style={{ width: 130 }}>İşlem</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.listeler.map((t) => (
                      <tr key={t.id}>
                        <td>
                          <Link href={`/liste/${t.slug}`}>{t.title}</Link>
                          {t.city && <span className="dim"> · {t.city}</span>}
                        </td>
                        <td className="font-num">{t.oySayisi}</td>
                        <td>
                          {t.menude === 1 ? (
                            <span className="comment-rozet">menüde</span>
                          ) : (
                            <span className="dim" style={{ fontSize: 12 }}>gizli</span>
                          )}
                        </td>
                        <td className="sag">
                          <form action={vitrinAction} style={{ display: "inline" }}>
                            <input type="hidden" name="id" value={t.id} />
                            <input type="hidden" name="donus" value={donusAdresi} />
                            {t.menude === 1 ? (
                              <button className="btn btn-sm" name="islem" value="menu-kapat">Gizle</button>
                            ) : (
                              <button className="btn btn-sm btn-primary" name="islem" value="menu-ac">Göster</button>
                            )}
                          </form>
                        </td>
                      </tr>
                    ))}
                    {g.listeler.length === 0 && (
                      <tr><td colSpan={4} className="dim">Bu kategoride eşleşen liste yok.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        );
      })}
    </>
  );
}
