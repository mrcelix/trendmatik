import Link from "next/link";
import { getUsersAdmin } from "@/lib/db";
import { uyeYonetAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function UyelerPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { ok, e } = await searchParams;
  const uyeler = await getUsersAdmin();
  const yoneticiler = uyeler.filter((u) => u.role === "admin").length;
  const askidakiler = uyeler.filter((u) => u.askida === 1).length;

  return (
    <>
      <div className="page-head">
        <h1>👥 Üyeler</h1>
        <span className="sub">
          {uyeler.length} üye · {yoneticiler} yönetici
          {askidakiler > 0 && ` · ${askidakiler} askıda`}
        </span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <div className="admin-tablo-sar">
        <table className="admin-tablo">
          <thead>
            <tr>
              <th>Üye</th>
              <th>Katılım</th>
              <th>Oy</th>
              <th>Düello</th>
              <th>Liste</th>
              <th>Yorum</th>
              <th className="sag">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {uyeler.map((u) => (
              <tr key={u.id} style={u.askida === 1 ? { opacity: 0.55 } : undefined}>
                <td>
                  <Link href={`/uye/${encodeURIComponent(u.username)}`}>
                    <b>{u.username}</b>
                  </Link>
                  {u.role === "admin" && <span className="comment-rozet" style={{ marginLeft: 6 }}>yönetici</span>}
                  {u.askida === 1 && (
                    <span className="badge-hot" style={{ marginLeft: 6, background: "var(--down-soft)", color: "var(--down)" }}>
                      askıda
                    </span>
                  )}
                </td>
                <td className="dim">{new Date(u.created_at * 1000).toLocaleDateString("tr-TR")}</td>
                <td className="font-num">{u.oy}</td>
                <td className="font-num">{u.duello}</td>
                <td className="font-num">{u.liste}</td>
                <td className="font-num">{u.yorum}</td>
                <td className="sag">
                  <form action={uyeYonetAction} style={{ display: "inline-flex", gap: 4 }}>
                    <input type="hidden" name="id" value={u.id} />
                    {u.role === "admin" ? (
                      <button className="btn btn-sm" name="islem" value="yetki-al">Yöneticiliği al</button>
                    ) : (
                      <button className="btn btn-sm" name="islem" value="yetki-ver">Yönetici yap</button>
                    )}
                    {u.askida === 1 ? (
                      <button className="btn btn-sm btn-primary" name="islem" value="askidan-cikar">
                        Askıdan çıkar
                      </button>
                    ) : (
                      <button className="btn btn-sm btn-danger" name="islem" value="askiya-al">
                        Askıya al
                      </button>
                    )}
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="form-note">
        Askıya alınan üye giriş yapamaz ve duyuru bildirimlerini almaz; içerikleri sitede kalır.
        Son yöneticinin yetkisi alınamaz ve kendi hesabında bu işlemleri yapamazsın.
      </p>
    </>
  );
}
