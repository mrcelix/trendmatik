import Link from "next/link";
import { getTopicsAdmin } from "@/lib/db";

export const dynamic = "force-dynamic";

const DURUM_ETIKET: Record<string, string> = {
  approved: "Yayında",
  pending: "Onay bekliyor",
  rejected: "Yayında değil",
};

export default async function ListelerPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string; durum?: string }>;
}) {
  const { ok, e, durum } = await searchParams;
  const hepsi = await getTopicsAdmin();
  const listeler = durum ? hepsi.filter((t) => t.status === durum) : hepsi;

  const sayim = {
    approved: hepsi.filter((t) => t.status === "approved").length,
    pending: hepsi.filter((t) => t.status === "pending").length,
    rejected: hepsi.filter((t) => t.status === "rejected").length,
  };

  return (
    <>
      <div className="page-head">
        <h1>📋 Listeler & Maddeler</h1>
        <span className="sub">{hepsi.length} liste</span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <div className="tabs">
        <Link href="/admin/listeler" className={`tab ${!durum ? "active" : ""}`}>
          Tümü ({hepsi.length})
        </Link>
        <Link href="/admin/listeler?durum=approved" className={`tab ${durum === "approved" ? "active" : ""}`}>
          Yayında ({sayim.approved})
        </Link>
        <Link href="/admin/listeler?durum=pending" className={`tab ${durum === "pending" ? "active" : ""}`}>
          Bekleyen ({sayim.pending})
        </Link>
        <Link href="/admin/listeler?durum=rejected" className={`tab ${durum === "rejected" ? "active" : ""}`}>
          Kaldırılan ({sayim.rejected})
        </Link>
      </div>

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
            {listeler.map((t) => (
              <tr key={t.id}>
                <td>
                  <b>{t.title}</b>
                  {t.city && <span className="city-tag" style={{ marginLeft: 6 }}>{t.city}</span>}
                  {t.one_cikan === 1 && (
                    <span className="badge-hot" style={{ marginLeft: 6 }}>hero</span>
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
                  <Link href={`/admin/listeler/${t.id}`} className="btn btn-sm btn-primary">
                    Yönet
                  </Link>
                </td>
              </tr>
            ))}
            {listeler.length === 0 && (
              <tr>
                <td colSpan={7} className="dim">Bu durumda liste yok.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
