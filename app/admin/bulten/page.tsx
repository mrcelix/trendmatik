import { bultenSayilari } from "@/lib/db";
import { epostaAcikMi } from "@/lib/eposta";
import { bultenIcerigiHazirla } from "@/lib/bulten-gonderim";
import { bultenGonderAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminBultenPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { ok, e } = await searchParams;
  const sayilar = await bultenSayilari();
  const onizleme = await bultenIcerigiHazirla();
  const acik = epostaAcikMi();

  return (
    <>
      <div className="page-head">
        <h1>✉️ Bülten</h1>
        <span className="sub">
          {sayilar.onayli} onaylı abone
          {sayilar.bekleyen > 0 && ` · ${sayilar.bekleyen} onay bekliyor`}
        </span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      {!acik && (
        <p className="alert-err">
          E-posta gönderimi yapılandırılmamış. Gönderim yapabilmek için ortam
          değişkenlerine <code>RESEND_API_KEY</code> (ve tercihen{" "}
          <code>EPOSTA_GONDEREN</code>) ekleyin. Abonelik formu bu durumda da
          çalışır, yalnızca onay e-postası gitmez.
        </p>
      )}

      <div className="admin-kart">
        <h2>Bu haftanın içeriği</h2>
        {onizleme ? (
          <>
            <p className="form-note" style={{ marginTop: 0 }}>
              <b>Konu:</b> {onizleme.baslik}
            </p>
            <ol className="bulten-onizleme">
              {onizleme.satirlar.map((s, i) => (
                <li key={i}>
                  <b>{s.baslik}</b>
                  <span dangerouslySetInnerHTML={{ __html: s.metin }} />
                  <code>{s.yol}</code>
                </li>
              ))}
            </ol>

            <form action={bultenGonderAction}>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={!acik || sayilar.onayli === 0}
              >
                {sayilar.onayli} aboneye gönder
              </button>
            </form>
            <p className="form-note">
              Gönderim geri alınamaz. Abone listesi yalnızca çift onaydan geçmiş
              adreslerden oluşur; her e-postanın altında çıkış bağlantısı vardır.
            </p>
          </>
        ) : (
          <p className="form-note" style={{ marginTop: 0 }}>
            Bu hafta bülten oluşturacak kadar hareket yok (zirve değişimi,
            yükselen madde ya da oy trafiği). Sıralamalar hareketlendiğinde
            içerik burada belirir.
          </p>
        )}
      </div>
    </>
  );
}
