import Link from "next/link";
import { getCategories, getTopicsAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

const SAYFA_BOYU = 50;

const DURUM_ETIKET: Record<string, string> = {
  approved: "Yayında",
  pending: "Onay bekliyor",
  rejected: "Yayında değil",
};

const SIRALAMALAR = [
  { id: "oy", ad: "En çok oy" },
  { id: "yeni", ad: "En yeni" },
  { id: "ad", ad: "Ada göre" },
  { id: "madde", ad: "Madde sayısı" },
] as const;
type Sirala = (typeof SIRALAMALAR)[number]["id"];

export default async function ListelerPage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string; e?: string; durum?: string; q?: string;
    kategori?: string; sirala?: string; sayfa?: string;
  }>;
}) {
  const sp = await searchParams;
  const { ok, e } = sp;
  const durum = sp.durum ?? "";
  const q = (sp.q ?? "").trim();
  const kategori = sp.kategori ?? "";
  const sirala = (SIRALAMALAR.some((s) => s.id === sp.sirala) ? sp.sirala : "oy") as Sirala;

  const [hepsi, kategoriler] = await Promise.all([getTopicsAdmin(), getCategories()]);

  // Türkçe karakterleri sadeleştiren arama — "sehir" yazınca "şehir" de bulunsun
  const norm = (s: string) =>
    s.toLocaleLowerCase("tr").replace(/[çğıöşü]/g, (c) =>
      ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u" })[c] ?? c
    );
  const terim = norm(q);

  const suzulmus = hepsi
    .filter((t) => !kategori || t.categorySlug === kategori)
    .filter(
      (t) =>
        !terim ||
        norm(t.title).includes(terim) ||
        norm(t.slug).includes(terim) ||
        norm(t.city ?? "").includes(terim)
    );

  // Durum sayıları diğer süzgeçlere göre: "bu aramada kaç bekleyen var"
  const sayim = {
    hepsi: suzulmus.length,
    approved: suzulmus.filter((t) => t.status === "approved").length,
    pending: suzulmus.filter((t) => t.status === "pending").length,
    rejected: suzulmus.filter((t) => t.status === "rejected").length,
  };

  const listelenen = [...suzulmus.filter((t) => !durum || t.status === durum)].sort((a, b) => {
    if (sirala === "ad") return a.title.localeCompare(b.title, "tr");
    if (sirala === "yeni") return b.created_at - a.created_at;
    if (sirala === "madde") return b.maddeSayisi - a.maddeSayisi;
    return b.oySayisi - a.oySayisi;
  });

  const sonSayfa = Math.max(0, Math.ceil(listelenen.length / SAYFA_BOYU) - 1);
  const sayfa = Math.min(Math.max(0, Number(sp.sayfa ?? 0) || 0), sonSayfa);
  const gorunen = listelenen.slice(sayfa * SAYFA_BOYU, (sayfa + 1) * SAYFA_BOYU);

  const adres = (ek: Record<string, string | number> = {}) => {
    const p = new URLSearchParams();
    if (q) p.set("q", q);
    if (kategori) p.set("kategori", kategori);
    if (durum) p.set("durum", durum);
    if (sirala !== "oy") p.set("sirala", sirala);
    if (sayfa > 0) p.set("sayfa", String(sayfa));
    for (const [k, v] of Object.entries(ek)) {
      if (v === "") p.delete(k);
      else p.set(k, String(v));
    }
    const s = p.toString();
    return `/admin/listeler${s ? `?${s}` : ""}`;
  };

  const sekme = (d: string, etiket: string, n: number) => (
    <Link href={adres({ durum: d, sayfa: "" })} className={`tab ${durum === d ? "active" : ""}`}>
      {etiket} ({n.toLocaleString("tr-TR")})
    </Link>
  );

  const suzgecAcik = Boolean(q || kategori || durum) || sirala !== "oy";

  return (
    <>
      <div className="page-head">
        <h1>📋 Listeler & Maddeler</h1>
        <span className="sub">{hepsi.length.toLocaleString("tr-TR")} liste</span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      {/* --- Arama ve süzgeçler --- */}
      <form className="admin-form" style={{ marginBottom: 12 }}>
        {durum && <input type="hidden" name="durum" value={durum} />}
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="q">Liste ara</label>
            <input id="q" name="q" defaultValue={q} placeholder="Başlık, adres ya da şehir…" />
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
            <label htmlFor="sirala">Sırala</label>
            <select id="sirala" name="sirala" defaultValue={sirala}>
              {SIRALAMALAR.map((s) => (
                <option key={s.id} value={s.id}>{s.ad}</option>
              ))}
            </select>
          </div>
          <button className="btn btn-primary" type="submit">Süz</button>
          {suzgecAcik && <Link href="/admin/listeler" className="btn">Temizle</Link>}
        </div>
      </form>

      <div className="tabs">
        {sekme("", "Tümü", sayim.hepsi)}
        {sekme("approved", "Yayında", sayim.approved)}
        {sekme("pending", "Bekleyen", sayim.pending)}
        {sekme("rejected", "Kaldırılan", sayim.rejected)}
      </div>

      <p className="form-note" style={{ marginTop: 0 }}>
        {listelenen.length.toLocaleString("tr-TR")} liste eşleşti
        {listelenen.length > SAYFA_BOYU &&
          ` · ${sayfa * SAYFA_BOYU + 1}–${sayfa * SAYFA_BOYU + gorunen.length} arası gösteriliyor`}
        .
      </p>

      <div className="admin-tablo-sar">
        <table className="admin-tablo">
          <thead>
            <tr>
              <th>Liste</th>
              <th>Kategori</th>
              <th>Madde</th>
              <th>Oy</th>
              <th>Yorum</th>
              <th>Durum</th>
              <th className="sag">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {gorunen.map((t) => (
              <tr key={t.id}>
                <td>
                  <b>{t.title}</b>
                  {t.city && <span className="city-tag" style={{ marginLeft: 6 }}>{t.city}</span>}
                  {t.one_cikan === 1 && (
                    <span className="badge-hot" style={{ marginLeft: 6 }}>hero</span>
                  )}
                  {t.menude !== 1 && (
                    <span className="comment-rozet" style={{ marginLeft: 6 }}>menüde değil</span>
                  )}
                  <div className="dim">/liste/{t.slug}</div>
                </td>
                <td>{t.categoryName}</td>
                <td className="font-num">{t.maddeSayisi}</td>
                <td className="font-num">{t.oySayisi}</td>
                <td className="font-num">{t.yorumSayisi}</td>
                <td>
                  <span
                    className="badge-hot"
                    style={
                      t.status === "approved"
                        ? { background: "var(--up-soft)", color: "var(--up)" }
                        : t.status === "pending"
                          ? undefined
                          : { background: "var(--down-soft)", color: "var(--down)" }
                    }
                  >
                    {DURUM_ETIKET[t.status] ?? t.status}
                  </span>
                </td>
                <td className="sag">
                  <div className="admin-actions" style={{ justifyContent: "flex-end" }}>
                    <Link href={`/liste/${t.slug}`} className="btn btn-sm" target="_blank">
                      Gör ↗
                    </Link>
                    <Link href={`/admin/listeler/${t.id}`} className="btn btn-sm btn-primary">
                      Yönet
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
            {gorunen.length === 0 && (
              <tr>
                <td colSpan={7} className="dim">Bu süzgeçte liste yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {sonSayfa > 0 && (
        <div className="kunye-sayfalama">
          {sayfa > 0 && (
            <Link className="btn btn-sm" href={adres({ sayfa: sayfa - 1 || "" })}>‹ Önceki</Link>
          )}
          <span className="dim">Sayfa {sayfa + 1} / {sonSayfa + 1}</span>
          {sayfa < sonSayfa && (
            <Link className="btn btn-sm" href={adres({ sayfa: sayfa + 1 })}>Sonraki ›</Link>
          )}
        </div>
      )}
    </>
  );
}
