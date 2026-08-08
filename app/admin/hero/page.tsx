import Link from "next/link";
import { getCategories, getTopicsAdmin } from "@/lib/db";
import { vitrinAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

/** Hero seçici bir kerede bu kadar liste taşıyor (bkz. getHeroData). */
const HERO_KATEGORI_LIMIT = 8;
const SAYFA_BOYU = 25;

/** Süzgeçlerin varsayılanı: adresi gereksiz parametreyle şişirmemek için tutuluyor. */
const VARSAYILAN_DURUM = "approved";
const VARSAYILAN_HERO = "yok";

const DURUM_ETIKET: Record<string, string> = {
  approved: "Yayında",
  pending: "Onay bekliyor",
  rejected: "Yayında değil",
};

type Durum = "approved" | "pending" | "rejected" | "tumu";
type HeroSuzgec = "yok" | "var" | "tumu";

export default async function AdminHeroPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string; e?: string; q?: string; kategori?: string;
    durum?: string; hero?: string; sayfa?: string;
  }>;
}) {
  const sp = await searchParams;
  const q = (sp.q ?? "").trim();
  const kategori = sp.kategori ?? "";
  const durum = (
    ["approved", "pending", "rejected", "tumu"].includes(sp.durum ?? "")
      ? sp.durum
      : VARSAYILAN_DURUM
  ) as Durum;
  const heroSuzgec = (
    ["yok", "var", "tumu"].includes(sp.hero ?? "") ? sp.hero : VARSAYILAN_HERO
  ) as HeroSuzgec;

  const [hepsi, kategoriler] = await Promise.all([getTopicsAdmin(), getCategories()]);

  // Hero yalnızca yayındaki listeleri gösterir (getHeroData → getTopicSummaries),
  // sıralama işlemleri de yayındakiler üzerinden yürür (vitrinAction).
  const yayinda = hepsi.filter((t) => t.status === "approved");
  const oneCikanlar = yayinda
    .filter((t) => t.one_cikan === 1)
    .sort((a, b) => a.hero_sira - b.hero_sira);

  // Öne çıkan işaretli ama yayında olmayanlar hero'da hiç görünmez — sessizce
  // kaybolmasınlar diye ayrıca uyarılıyor.
  const yayindaOlmayanOneCikan = hepsi.filter(
    (t) => t.one_cikan === 1 && t.status !== "approved"
  );

  const norm = (s: string) =>
    s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) =>
      ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c
    );
  const aramaTerimi = norm(q);
  const eslesir = (t: { title: string; city?: string | null }) =>
    !aramaTerimi || norm(t.title).includes(aramaTerimi) || norm(t.city ?? "").includes(aramaTerimi);

  // Öne çıkanlarda da arama yapılır; sıra numarası gerçek konumdur, süzgeç
  // açıkken bile ▲▼ ve "Taşı" doğru satırı hedefler.
  const oneCikanGorunen = oneCikanlar
    .map((t, i) => ({ t, no: i + 1 }))
    .filter(({ t }) => eslesir(t))
    .filter(({ t }) => !kategori || t.categorySlug === kategori);
  const oneCikanSuzuldu = oneCikanGorunen.length !== oneCikanlar.length;

  // Havuz: 600+ listeyi tek ekrana basmak yerine aranıp süzülüyor
  const havuzTaban = hepsi
    .filter((t) => !kategori || t.categorySlug === kategori)
    .filter(eslesir)
    .filter((t) =>
      heroSuzgec === "tumu" ? true : heroSuzgec === "var" ? t.one_cikan === 1 : t.one_cikan !== 1
    );

  // Sekme sayıları diğer süzgeçlere göre hesaplanır: "bu aramada kaç bekleyen var".
  const sayim = {
    approved: havuzTaban.filter((t) => t.status === "approved").length,
    pending: havuzTaban.filter((t) => t.status === "pending").length,
    rejected: havuzTaban.filter((t) => t.status === "rejected").length,
    tumu: havuzTaban.length,
  };

  const havuzTumu = havuzTaban
    .filter((t) => durum === "tumu" || t.status === durum)
    .sort((a, b) => b.oySayisi - a.oySayisi);

  const sonSayfa = Math.max(0, Math.ceil(havuzTumu.length / SAYFA_BOYU) - 1);
  // Süzgeç daralınca elde olmayan sayfa numarasında kalınmasın
  const sayfa = Math.min(Math.max(0, Number(sp.sayfa ?? 0) || 0), sonSayfa);
  const havuz = havuzTumu.slice(sayfa * SAYFA_BOYU, (sayfa + 1) * SAYFA_BOYU);

  const adres = (ek: Record<string, string | number> = {}) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (kategori) p.set("kategori", kategori);
    if (durum !== VARSAYILAN_DURUM) p.set("durum", durum);
    if (heroSuzgec !== VARSAYILAN_HERO) p.set("hero", heroSuzgec);
    if (sayfa > 0) p.set("sayfa", String(sayfa));
    for (const [k, v] of Object.entries(ek)) {
      if (v === "") p.delete(k);
      else p.set(k, String(v));
    }
    const s = p.toString();
    return `/admin/hero${s ? `?${s}` : ""}`;
  };

  // İşlem sonrası aynı görünüme dönülsün: arama, süzgeçler ve sayfa korunur
  const donusAdresi = adres();
  const suzgecAcik = Boolean(q || kategori) || durum !== VARSAYILAN_DURUM || heroSuzgec !== VARSAYILAN_HERO;

  const durumSekmesi = (d: Durum, etiket: string, n: number) => (
    <Link
      href={adres({ durum: d === VARSAYILAN_DURUM ? "" : d, sayfa: "" })}
      className={`tab ${durum === d ? "active" : ""}`}
    >
      {etiket} ({n})
    </Link>
  );

  const durumRozeti = (s: string) => (
    <span
      className="badge-hot"
      style={
        s === "approved"
          ? { background: "var(--up-soft)", color: "var(--up)" }
          : s === "rejected"
            ? { background: "var(--down-soft)", color: "var(--down)" }
            : undefined
      }
    >
      {DURUM_ETIKET[s] ?? s}
    </span>
  );

  return (
    <>
      <div className="page-head">
        <h1>✨ Hero Alanı</h1>
        <span className="sub">
          {oneCikanlar.length} öne çıkan · {yayinda.length} yayındaki liste
        </span>
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
        <h2>
          Öne çıkanlar ({oneCikanlar.length})
          {oneCikanSuzuldu && (
            <span className="dim" style={{ fontSize: 12.5, fontWeight: 400, marginLeft: 8 }}>
              süzgeçte {oneCikanGorunen.length} tanesi görünüyor
            </span>
          )}
        </h2>

        {oneCikanlar.length === 0 && (
          <p className="admin-empty">
            Henüz öne çıkan liste yok — aşağıdaki havuzdan ekleyebilirsin.
          </p>
        )}
        {oneCikanlar.length > 0 && oneCikanGorunen.length === 0 && (
          <p className="admin-empty">
            Öne çıkanlar arasında aramaya uyan liste yok.{" "}
            <Link href={adres({ q: "", kategori: "" })}>Süzgeci temizle</Link>
          </p>
        )}
        {oneCikanSuzuldu && oneCikanGorunen.length > 0 && (
          <p className="form-note" style={{ marginTop: 0 }}>
            Numaralar gerçek hero sırasıdır; ▲▼ ve &quot;Taşı&quot; süzgeç açıkken de
            tüm listeye göre çalışır.
          </p>
        )}

        {oneCikanGorunen.map(({ t, no }) => (
          <div className="admin-row" key={t.id}>
            <span className="rerank-no font-num">{no}</span>
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
                <button className="btn btn-sm" name="islem" value="yukari" disabled={no === 1} title="Yukarı">▲</button>
                <button
                  className="btn btn-sm" name="islem" value="asagi"
                  disabled={no === oneCikanlar.length} title="Aşağı"
                >
                  ▼
                </button>
                {/* Uzun listede tek tek taşımak yerine doğrudan konum */}
                <input
                  name="sira" type="number" min={1} max={oneCikanlar.length}
                  defaultValue={no} aria-label="Sıra"
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

        {/* Yayından kalkmış ama işareti duran listeler: hero'da görünmüyorlar */}
        {yayindaOlmayanOneCikan.length > 0 && (
          <>
            <p className="form-note" style={{ marginBottom: 6 }}>
              <b>{yayindaOlmayanOneCikan.length} liste</b> öne çıkan işaretli ama yayında
              değil; hero&apos;da <b>görünmüyorlar</b>. Yayına alın ya da işareti kaldırın.
            </p>
            {yayindaOlmayanOneCikan.map((t) => (
              <div className="admin-row" key={t.id}>
                <div className="grow">
                  <b>
                    <Link href={`/liste/${t.slug}`}>{t.title}</Link>
                  </b>{" "}
                  {durumRozeti(t.status)}
                  <div className="dim">
                    {t.categoryName}
                    {t.city && ` · ${t.city}`} · {t.oySayisi} oy
                  </div>
                </div>
                <div className="admin-actions">
                  <Link href={`/admin/listeler/${t.id}`} className="btn btn-sm">Yönet</Link>
                  <form action={vitrinAction} style={{ display: "inline" }}>
                    <input type="hidden" name="id" value={t.id} />
                    <input type="hidden" name="donus" value={donusAdresi} />
                    <button className="btn btn-sm btn-danger" name="islem" value="hero-kapat">
                      İşareti kaldır
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </>
        )}
      </section>

      {/* --- Havuz: ara, süz, ekle/çıkar --- */}
      <section className="admin-section">
        <h2>Liste havuzu</h2>

        <form className="admin-form" style={{ marginBottom: 12 }}>
          {/* Sekmeyle seçilen durum süzgeç formunda kaybolmasın */}
          {durum !== VARSAYILAN_DURUM && <input type="hidden" name="durum" value={durum} />}
          <div className="admin-form-satir">
            <div className="field">
              <label htmlFor="q">Liste ara</label>
              <input id="q" name="q" defaultValue={q} placeholder="Başlık veya şehir…" />
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
            <div className="field">
              <label htmlFor="hero">Hero durumu</label>
              <select id="hero" name="hero" defaultValue={heroSuzgec}>
                <option value="yok">Hero&apos;da olmayanlar</option>
                <option value="var">Hero&apos;da olanlar</option>
                <option value="tumu">Tümü</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">Süz</button>
            {suzgecAcik && <Link href="/admin/hero" className="btn">Temizle</Link>}
          </div>
        </form>

        <div className="tabs">
          {durumSekmesi("approved", "Yayında", sayim.approved)}
          {durumSekmesi("pending", "Onay bekleyen", sayim.pending)}
          {durumSekmesi("rejected", "Yayında değil", sayim.rejected)}
          {durumSekmesi("tumu", "Tümü", sayim.tumu)}
        </div>

        <p className="form-note" style={{ marginTop: 0 }}>
          {havuzTumu.length.toLocaleString("tr-TR")} liste eşleşti, en çok oy alanlar
          önce. {havuz.length} tanesi gösteriliyor.
          {durum !== "approved" && " Yalnızca yayındaki listeler hero'ya eklenebilir."}
        </p>

        {havuz.map((t) => (
          <div className="admin-row" key={t.id}>
            <div className="grow">
              <b>
                <Link href={`/liste/${t.slug}`}>{t.title}</Link>
              </b>{" "}
              {durum === "tumu" && durumRozeti(t.status)}
              {t.one_cikan === 1 && t.status === "approved" && (
                <span className="badge-hot" style={{ marginLeft: 4 }}>hero</span>
              )}
              <div className="dim">
                {t.categoryName}
                {t.city && ` · ${t.city}`} · {t.oySayisi} oy
              </div>
            </div>
            <div className="admin-actions">
              {t.status !== "approved" ? (
                <>
                  <span className="dim" style={{ fontSize: 12.5 }}>
                    {DURUM_ETIKET[t.status] ?? t.status}
                  </span>
                  <Link href={`/admin/listeler/${t.id}`} className="btn btn-sm">
                    Önce yayına al
                  </Link>
                </>
              ) : (
                <form action={vitrinAction}>
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="donus" value={donusAdresi} />
                  {t.one_cikan === 1 ? (
                    <button className="btn btn-sm btn-danger" name="islem" value="hero-kapat">
                      Hero&apos;dan çıkar
                    </button>
                  ) : (
                    <button className="btn btn-sm btn-primary" name="islem" value="hero-ac">
                      Hero&apos;ya ekle
                    </button>
                  )}
                </form>
              )}
            </div>
          </div>
        ))}

        {havuz.length === 0 && <p className="admin-empty">Eşleşen liste yok.</p>}

        {sonSayfa > 0 && (
          <div className="kunye-sayfalama">
            {sayfa > 0 && <Link className="btn btn-sm" href={adres({ sayfa: sayfa - 1 || "" })}>‹ Önceki</Link>}
            <span className="dim">Sayfa {sayfa + 1} / {sonSayfa + 1}</span>
            {sayfa < sonSayfa && <Link className="btn btn-sm" href={adres({ sayfa: sayfa + 1 })}>Sonraki ›</Link>}
          </div>
        )}
      </section>
    </>
  );
}
