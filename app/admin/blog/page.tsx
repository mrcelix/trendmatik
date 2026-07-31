import Link from "next/link";
import { getBlogYazilariAdmin } from "@/lib/db";
import { blogEkleAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function BlogYonetimPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { ok, e } = await searchParams;
  const yazilar = await getBlogYazilariAdmin();
  const yayinda = yazilar.filter((y) => y.durum === "yayinda").length;

  return (
    <>
      <div className="page-head">
        <h1>📝 Blog</h1>
        <span className="sub">
          {yazilar.length} yazı · {yayinda} yayında
        </span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <form action={blogEkleAction} className="admin-form">
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="baslik">Yeni yazı başlığı</label>
            <input id="baslik" name="baslik" placeholder="Örn: Bu ayın trend analizi" required minLength={3} maxLength={120} />
          </div>
          <button className="btn btn-primary" type="submit">Taslak Oluştur</button>
        </div>
      </form>

      <div className="admin-tablo-sar">
        <table className="admin-tablo">
          <thead>
            <tr>
              <th>Başlık</th>
              <th>Durum</th>
              <th>Görüntülenme</th>
              <th>Güncelleme</th>
              <th className="sag">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {yazilar.map((y) => (
              <tr key={y.id}>
                <td>
                  <b>{y.baslik}</b>
                  <div className="dim">
                    /blog/{y.slug}
                    {y.yazar && ` · ${y.yazar}`}
                  </div>
                </td>
                <td>
                  <span
                    className="badge-hot"
                    style={y.durum === "yayinda" ? { background: "var(--up-soft)", color: "var(--up)" } : undefined}
                  >
                    {y.durum === "yayinda" ? "Yayında" : "Taslak"}
                  </span>
                </td>
                <td className="font-num">{y.goruntulenme}</td>
                <td className="dim">{new Date(y.updated_at * 1000).toLocaleDateString("tr-TR")}</td>
                <td className="sag">
                  <Link href={`/admin/blog/${y.id}`} className="btn btn-sm btn-primary">Düzenle</Link>
                </td>
              </tr>
            ))}
            {yazilar.length === 0 && (
              <tr><td colSpan={5} className="dim">Henüz yazı yok. Yukarıdan ilk taslağı oluştur.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
