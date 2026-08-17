import Link from "next/link";
import { notFound } from "next/navigation";
import { getSayfaById } from "@/lib/db";
import { sayfaGuncelleAction, sayfaSilAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SayfaDuzenlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { id } = await params;
  const { ok, e } = await searchParams;
  const sayfa = await getSayfaById(Number(id));
  if (!sayfa) notFound();

  return (
    <>
      <div className="breadcrumb">
        <Link href="/admin/sayfalar">← Sayfalar</Link>
      </div>
      <div className="page-head">
        <h1>{sayfa.baslik}</h1>
        {sayfa.durum === "yayinda" && (
          <Link href={`/sayfa/${sayfa.slug}`} className="btn btn-sm" target="_blank">
            Sitede gör ↗
          </Link>
        )}
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <form action={sayfaGuncelleAction} className="admin-form">
        <input type="hidden" name="id" value={sayfa.id} />

        <div className="field">
          <label htmlFor="baslik">Başlık</label>
          <input id="baslik" name="baslik" defaultValue={sayfa.baslik} required minLength={2} maxLength={80} />
        </div>

        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="slug">Adres (/sayfa/…)</label>
            <input id="slug" name="slug" defaultValue={sayfa.slug} maxLength={80} />
          </div>
          <div className="field">
            <label htmlFor="durum">Durum</label>
            <select id="durum" name="durum" defaultValue={sayfa.durum}>
              <option value="taslak">Taslak (yalnızca yönetimde)</option>
              <option value="yayinda">Yayında</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="sira">Sıra</label>
            <input id="sira" name="sira" type="number" defaultValue={sayfa.sira} style={{ width: 90 }} />
          </div>
        </div>

        <div className="field">
          <label htmlFor="ozet">Kısa açıklama (arama sonuçlarında görünür)</label>
          <input id="ozet" name="ozet" defaultValue={sayfa.ozet} maxLength={200} />
        </div>

        <div className="field">
          <label htmlFor="icerik">İçerik</label>
          <textarea
            id="icerik"
            name="icerik"
            defaultValue={sayfa.icerik}
            rows={18}
            placeholder={"Her boş satır yeni paragraf başlatır.\n\nSatır başına \"## \" yazarsanız ara başlık olur."}
          />
        </div>

        <div className="admin-form-satir" style={{ marginTop: 8 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input
              type="checkbox"
              name="altbilgide"
              defaultChecked={sayfa.altbilgide === 1}
              style={{ width: "auto" }}
            />
            Alt bilgi menüsünde göster
          </label>
          <button className="btn btn-primary" type="submit">Kaydet</button>
        </div>

        <p className="form-note">
          Biçimlendirme sade tutuldu: boş satır paragraf ayırır, <code>## </code> ile başlayan
          satır ara başlık olur. HTML yazılırsa metin olarak görünür — sayfa içeriği
          doğrudan HTML olarak basılmıyor.
        </p>
      </form>

      <section className="admin-section" style={{ marginTop: 20 }}>
        <h2>Sayfayı sil</h2>
        <p className="form-note" style={{ marginTop: 0 }}>
          Geri alınamaz. Yayındaki bir sayfayı silmeden önce taslağa çekip adresin
          bir yerde bağlantılı olmadığından emin olun.
        </p>
        <form action={sayfaSilAction}>
          <input type="hidden" name="id" value={sayfa.id} />
          <button className="btn btn-sm btn-danger" type="submit">Sayfayı sil</button>
        </form>
      </section>
    </>
  );
}
