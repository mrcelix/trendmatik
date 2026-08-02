import Link from "next/link";
import { getCategories, getTopicsAdmin } from "@/lib/db";
import { vitrinAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Hero seçici bir kerede bu kadar liste taşıyor (bkz. getHeroData). */
const HERO_KATEGORI_LIMIT = 8;
const SAYFA_BOYU = 25;

export default async function AdminHeroPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string; q?: string; kategori?: string; sayfa?: string }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const kategori = sp.kategori ?? "";
  const sayfa = Number(sp.sayfa ?? 0) || 0;

  const [hepsiHam, kategoriler] = await Promise.all([getTopicsAdmin(), getCategories()]);
  const hepsi = hepsiHam.filter((t) => t.status === "approved");

  const oneCikanlar = hepsi
    .filter((t) => t.one_cikan === 1)
    .sort((a, b) => a.hero_sira - b.hero_sira);

  // Aday havuzu: 600+ listeyi tek ekrana basmak yerine aranıp süzülüyor
  const norm = (s: string) =>
    s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) =>
      ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c
    );
  const aramaTerimi = norm(q);
  const adaylarTumu = hepsi
    .filter((t) => t.one_cikan !== 1)
    .filter((t) => !kategori || t.categorySlug === kategori)
    .filter((t) => !aramaTerimi || norm(t.title).includes(aramaTerimi))
    .sort((a, b) => b.oySayisi - a.oySayisi);

  const adaylar = adaylarTumu.slice(sayfa * SAYFA_BOYU, (sayfa + 1) * SAYFA_BOYU);
  const sonSayfa = Math.max(0, Math.ceil(adaylarTumu.length / SAYFA_BOYU) - 1);

  const adres = (ek: Record<string, string | number>) => {
    const p = new URLSearchParams({ ...(q && { q }), ...(kategori && { kategori }) });
    for (const [k, v] of Object.entries(ek)) {
      if (v === "") p.delete(k);
      else p.set(k, String(v));
    }
    return `/admin/hero?${p}`;
  };

  // İşlem sonrası aynı görünüme dönülsün: arama, kategori ve sayfa korunur
  const donusAdresi = (() => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (kategori) p.set("kategori", kategori);
    if (sayfa > 0) p.set("sayfa", String(sayfa));
    return `/admin/hero${p.size ? `?${p}` : ""}`;
  })();

  return (
    <>
      <div className="page-head">
        <h1>✨ Hero Alanı</h1>
        <span className="sub">Ana sayfadaki bulucuda öne çıkan listeler</span>
      </div>

      {sp.ok && <p className="alert-ok">{sp.ok}</p>}
      {sp.e && <p className="alert-err">{sp.e}</p>}

      <p className="form-note" style={{ marginTop: 0 }}>
        Buradaki listeler ana sayfadaki bulucuda <b>verdiğin sırayla</b> en üstte
        görünür. Hiçbiri seçili değilse bulucu popülerlik sırasını kullanır.
        Öne çıkarılanların tamamı hero&apos;ya taşınır; ayrıca her kategoriden en
        popüler {HERO_KATEGORI_LIMIT} liste otomatik eklenir.
        Mega menü ayarları <Link href="/admin/menu">Mega Menü</Link> bölümünde.
      </p>

      {/* --- Öne çıkanlar --- */}
      <section className="admin-section">
        <h2>Öne çıkanlar ({oneCikanlar.length})</h2>
        {oneCikanlar.length === 0 && (
          <p className="admin-empty">
            Henüz öne çıkan liste yok — aşağıdaki havuzdan ekleyebilirsin.
          </p>
        )}

        {oneCikanlar.map((t, i) => (
          <div className="admin-row" key={t.id}>
            <span className="rerank-no font-num">{i + 1}</span>
            <div className="grow">
              <b>
                <Link href={`/liste/${t.slug}`}>{t.title}</Link>
              </b>
              <div className="dim">
                {t.categoryName}
                {t.city && ` · ${t.city}`} · {t.oySayisi} oy · {t.maddeSayisi} madde
              </div>
            </div>
            <div className="admin-actions">
              <form action={vitrinAction} style={{ display: "inline-flex", gap: 4, alignItems: "center" }}>
                <input type="hidden" name="id" value={t.id} />
                <input type="hidden" name="donus" value={donusAdresi} />
                <button className="btn btn-sm" name="islem" value="yukari" disabled={i === 0} title="Yukarı">▲</button>
                <button
                  className="btn btn-sm" name="islem" value="asagi"
                  disabled={i === oneCikanlar.length - 1} title="Aşağı"
                >
                  ▼
                </button>
                {/* Uzun listede tek tek taşımak yerine doğrudan konum */}
                <input
                  name="sira" type="number" min={1} max={oneCikanlar.length}
                  defaultValue={i + 1} aria-label="Sıra"
                  style={{ width: 58, height: 32 }}
                />
                <button className="btn btn-sm" name="islem" value="sira-ver" title="Bu konuma taşı">
                  Taşı
                </button>
                <button className="btn btn-sm btn-danger" name="islem" value="hero-kapat">
                  Çıkar
                </button>
              </form>
            </div>
          </div>
        ))}
      </section>

      {/* --- Aday havuzu --- */}
      <section className="admin-section">
        <h2>Hero&apos;ya ekle</h2>

        <form className="admin-form" style={{ marginBottom: 12 }}>
          <div className="admin-form-satir">
            <div className="field">
              <label htmlFor="q">Liste ara</label>
              <input id="q" name="q" defaultValue={q} placeholder="Başlıkta ara…" />
            </div>
            <div className="field">
              <label htmlFor="kategori">Kategori</label>
              <select id="kategori" name="kategori" defaultValue={kategori}>
                <option value="">Tümü</option>
                {kategoriler.map((k) => (
                  <option key={k.id} value={k.slug}>{k.emoji} {k.name}</option>
                ))}
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Süz</button>
            {(q || kategori) && (
              <Link href="/admin/hero" className="btn">Temizle</Link>
            )}
          </div>
        </form>

        <p className="form-note" style={{ marginTop: 0 }}>
          {adaylarTumu.length.toLocaleString("tr-TR")} liste eşleşti, en çok oy alanlar
          önce. {adaylar.length} tanesi gösteriliyor.
        </p>

        {adaylar.map((t) => (
          <div className="admin-row" key={t.id}>
            <div className="grow">
              <b>
                <Link href={`/liste/${t.slug}`}>{t.title}</Link>
              </b>
              <div className="dim">
                {t.categoryName}
                {t.city && ` · ${t.city}`} · {t.oySayisi} oy
              </div>
            </div>
            <form action={vitrinAction}>
              <input type="hidden" name="id" value={t.id} />
              <input type="hidden" name="donus" value={donusAdresi} />
              <button className="btn btn-sm btn-primary" name="islem" value="hero-ac">
                Hero&apos;ya ekle
              </button>
            </form>
          </div>
        ))}

        {adaylar.length === 0 && <p className="admin-empty">Eşleşen liste yok.</p>}

        {sonSayfa > 0 && (
          <div className="kunye-sayfalama">
            {sayfa > 0 && <Link className="btn btn-sm" href={adres({ sayfa: sayfa - 1 })}>‹ Önceki</Link>}
            <span className="dim">Sayfa {sayfa + 1} / {sonSayfa + 1}</span>
            {sayfa < sonSayfa && <Link className="btn btn-sm" href={adres({ sayfa: sayfa + 1 })}>Sonraki ›</Link>}
          </div>
        )}
      </section>
    </>
  );
}
