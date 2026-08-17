import Link from "next/link";
import { getSayfalarAdmin } from "@/lib/db";
import { sayfaEkleAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminSayfalarPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { ok, e } = await searchParams;
  const sayfalar = await getSayfalarAdmin();
  const yayinda = sayfalar.filter((s) => s.durum === "yayinda").length;

  return (
    <>
      <div className="page-head">
        <h1>📄 Sayfalar</h1>
        <span className="sub">
          {sayfalar.length} sayfa · {yayinda} yayında
        </span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <p className="form-note" style={{ marginTop: 0 }}>
        Hakkımızda, Gizlilik, İletişim gibi sabit içerik sayfaları.
        Yayına alınanlar <code>/sayfa/adres</code> adresinde açılır, istenirse alt bilgi
        menüsünde listelenir ve site haritasına girer. Taslaklar yalnızca burada görünür.
      </p>

      {/* --- Yeni sayfa --- */}
      <form action={sayfaEkleAction} className="admin-form" style={{ marginBottom: 18 }}>
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="baslik">Yeni sayfa başlığı</label>
            <input id="baslik" name="baslik" placeholder="Örn: Hakkımızda" required minLength={2} maxLength={80} />
          </div>
          <button className="btn btn-primary" type="submit">Oluştur</button>
        </div>
        <p className="form-note" style={{ marginTop: 6 }}>
          Sayfa <b>taslak</b> olarak açılır; içeriğini yazıp yayına alırsınız.
        </p>
      </form>

      {sayfalar.length === 0 && (
        <p className="admin-empty">
          Henüz sayfa yok. Sitede genelde bulunması beklenenler: Hakkımızda, Gizlilik
          Politikası, İletişim, Kullanım Koşulları.
        </p>
      )}

      {sayfalar.map((s) => (
        <div className="admin-row" key={s.id}>
          <span className="rerank-no font-num">{s.sira}</span>
          <div className="grow">
            <b>{s.baslik}</b>{" "}
            {s.durum === "yayinda" ? (
              <span className="badge-hot" style={{ background: "var(--up-soft)", color: "var(--up)" }}>
                yayında
              </span>
            ) : (
              <span className="comment-rozet">taslak</span>
            )}
            {s.altbilgide === 1 && s.durum === "yayinda" && (
              <span className="comment-rozet" style={{ marginLeft: 4 }}>alt bilgide</span>
            )}
            <div className="dim">
              /sayfa/{s.slug}
              {s.ozet && ` · ${s.ozet.slice(0, 70)}`}
            </div>
          </div>
          <div className="admin-actions">
            {s.durum === "yayinda" && (
              <Link href={`/sayfa/${s.slug}`} className="btn btn-sm" target="_blank">
                Gör ↗
              </Link>
            )}
            <Link href={`/admin/sayfalar/${s.id}`} className="btn btn-sm btn-primary">
              Düzenle
            </Link>
          </div>
        </div>
      ))}
    </>
  );
}
