import Link from "next/link";
import { notFound } from "next/navigation";
import { getBlogYaziById } from "@/lib/db";
import { blogGuncelleAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function BlogDuzenlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string }>;
}) {
  const { id } = await params;
  const { ok } = await searchParams;
  const yazi = await getBlogYaziById(Number(id));
  if (!yazi) notFound();

  return (
    <>
      <div className="breadcrumb">
        <Link href="/admin/blog">← Blog</Link>
      </div>
      <div className="page-head">
        <h1>{yazi.baslik}</h1>
        {yazi.durum === "yayinda" && (
          <Link href={`/blog/${yazi.slug}`} className="btn btn-sm" target="_blank">
            Sitede gör ↗
          </Link>
        )}
      </div>

      {ok && <p className="alert-ok">{ok}</p>}

      <form action={blogGuncelleAction} className="admin-form">
        <input type="hidden" name="id" value={yazi.id} />

        <div className="field">
          <label htmlFor="baslik">Başlık</label>
          <input id="baslik" name="baslik" defaultValue={yazi.baslik} maxLength={120} required />
        </div>

        <div className="field">
          <label htmlFor="ozet">Özet (arama sonuçlarında ve liste sayfasında görünür)</label>
          <input id="ozet" name="ozet" defaultValue={yazi.ozet} maxLength={300} />
        </div>

        <div className="field">
          <label htmlFor="kapak">Kapak görseli adresi (isteğe bağlı)</label>
          <input id="kapak" name="kapak" defaultValue={yazi.kapak} placeholder="https://…" maxLength={300} />
        </div>

        <div className="field">
          <label htmlFor="icerik">İçerik</label>
          <textarea
            id="icerik"
            name="icerik"
            defaultValue={yazi.icerik}
            rows={18}
            placeholder={"Paragrafları boş satırla ayır.\n\nSatır başına ## yazarsan ara başlık olur."}
            style={{ minHeight: 360, fontFamily: "var(--font-mono)", fontSize: 13.5 }}
          />
        </div>

        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="durum">Durum</label>
            <select id="durum" name="durum" defaultValue={yazi.durum}>
              <option value="taslak">Taslak</option>
              <option value="yayinda">Yayında</option>
            </select>
          </div>
          <button className="btn btn-primary" name="islem" value="kaydet" type="submit">Kaydet</button>
          <button className="btn btn-danger" name="islem" value="sil" type="submit">Yazıyı sil</button>
        </div>

        <p className="form-note">
          Adres: <code>/blog/{yazi.slug}</code> · Görüntülenme:{" "}
          <span className="font-num">{yazi.goruntulenme}</span>
        </p>
      </form>
    </>
  );
}
