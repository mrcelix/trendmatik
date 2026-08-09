import Link from "next/link";
import { getCategories } from "@/lib/db";
import { adaylariEslestir } from "@/lib/gundem";
import { gundemAdaylari, PENCERELER, type Pencere } from "@/lib/gundemKaynak";
import { gundemdenTaslakAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

const VARSAYILAN: Pencere = 7;

const PENCERE_ETIKET: Record<Pencere, string> = {
  1: "Son 1 gün",
  7: "Son 7 gün",
  15: "Son 15 gün",
  30: "Son 30 gün",
};

const sayi = (n: number) => n.toLocaleString("tr-TR");

export default async function AdminGundemPage({
  searchParams,
}: {
  searchParams: Promise<{ gun?: string; ok?: string; e?: string; durum?: string }>;
}) {
  const sp = await searchParams;
  const istenen = Number(sp.gun);
  const pencere = (PENCERELER as readonly number[]).includes(istenen)
    ? (istenen as Pencere)
    : VARSAYILAN;
  const durumSuzgec = ["yeni", "mevcut"].includes(sp.durum ?? "") ? sp.durum : "";

  const [kaynak, kategoriler] = await Promise.all([gundemAdaylari(pencere), getCategories()]);
  const eslesmeler = await adaylariEslestir(kaynak.adaylar.map((a) => a.baslik));

  const satirlar = kaynak.adaylar.map((aday, i) => ({ aday, ...eslesmeler[i] }));
  const yeniSayisi = satirlar.filter((s) => s.eslesme.tur === "yeni").length;
  const mevcutSayisi = satirlar.length - yeniSayisi;

  const gorunen = satirlar.filter((s) =>
    durumSuzgec === "yeni"
      ? s.eslesme.tur === "yeni"
      : durumSuzgec === "mevcut"
        ? s.eslesme.tur !== "yeni"
        : true
  );

  const adres = (ek: Record<string, string | number>) => {
    const p = new URLSearchParams();
    if (pencere !== VARSAYILAN) p.set("gun", String(pencere));
    if (durumSuzgec) p.set("durum", durumSuzgec);
    for (const [k, v] of Object.entries(ek)) {
      if (v === "") p.delete(k);
      else p.set(k, String(v));
    }
    const s = p.toString();
    return `/admin/gundem${s ? `?${s}` : ""}`;
  };

  return (
    <>
      <div className="page-head">
        <h1>🔎 Gündemi Tara</h1>
        <span className="sub">Yeni başlık fikirleri için gündem adayları</span>
      </div>

      {sp.ok && <p className="alert-ok">{sp.ok}</p>}
      {sp.e && <p className="alert-err">{sp.e}</p>}

      <p className="form-note" style={{ marginTop: 0 }}>
        Seçtiğin aralıkta Türkiye&apos;de en çok ilgi gören konular listelenir ve her biri
        sitedeki içerikle karşılaştırılır: <b>zaten bir listeyle örtüşüyorsa</b> hangi liste
        olduğu, <b>madde olarak varsa</b> o bilgi, hiçbiri değilse <b>yeni</b> etiketi
        gösterilir. Karşılaştırma, otomatik taramanın kullandığı eşleştirmenin aynısıdır
        (<Link href="/admin/moderasyon">Moderasyon</Link> bölümündeki günlük tarama).
      </p>

      <div className="tabs">
        {PENCERELER.map((p) => (
          <Link
            key={p}
            href={adres({ gun: p === VARSAYILAN ? "" : p })}
            className={`tab ${pencere === p ? "active" : ""}`}
          >
            {PENCERE_ETIKET[p]}
          </Link>
        ))}
      </div>

      {kaynak.hata && <p className="alert-err">{kaynak.hata}</p>}

      {!kaynak.hata && (
        <>
          <div className="admin-kartlar" style={{ marginBottom: 14 }}>
            <div className="admin-kart">
              <b className="font-num">{sayi(satirlar.length)}</b>
              <span>Gündem adayı</span>
            </div>
            <div className="admin-kart">
              <b className="font-num">{sayi(yeniSayisi)}</b>
              <span>Sitede yok</span>
            </div>
            <div className="admin-kart">
              <b className="font-num">{sayi(mevcutSayisi)}</b>
              <span>Karşılığı var</span>
            </div>
          </div>

          <div className="tabs">
            <Link href={adres({ durum: "" })} className={`tab ${!durumSuzgec ? "active" : ""}`}>
              Tümü ({satirlar.length})
            </Link>
            <Link
              href={adres({ durum: "yeni" })}
              className={`tab ${durumSuzgec === "yeni" ? "active" : ""}`}
            >
              Sitede yok ({yeniSayisi})
            </Link>
            <Link
              href={adres({ durum: "mevcut" })}
              className={`tab ${durumSuzgec === "mevcut" ? "active" : ""}`}
            >
              Karşılığı var ({mevcutSayisi})
            </Link>
          </div>
        </>
      )}

      <section className="admin-section">
        {gorunen.map(({ aday, eslesme, islendi }, i) => (
          <div className="admin-row" key={aday.baslik}>
            <span className="rerank-no font-num">{i + 1}</span>
            <div className="grow">
              <b>{aday.baslik}</b>{" "}
              {eslesme.tur === "yeni" ? (
                <span className="badge-hot" style={{ background: "var(--up-soft)", color: "var(--up)" }}>
                  sitede yok
                </span>
              ) : eslesme.tur === "madde-var" ? (
                <span className="comment-rozet">madde olarak var</span>
              ) : (
                <span className="comment-rozet">listeyle örtüşüyor</span>
              )}
              {islendi && (
                <span className="comment-rozet" style={{ marginLeft: 4 }}>
                  otomatik tarama işlemişti
                </span>
              )}
              <div className="dim">
                {sayi(aday.goruntulenme)} görüntülenme
                {eslesme.tur === "liste-var" && (
                  <>
                    {" · "}
                    <Link href={`/admin/listeler/${eslesme.listeId}`}>{eslesme.listeBaslik}</Link>
                    {` (${eslesme.skor} ortak kelime)`}
                  </>
                )}
              </div>
            </div>
            <div className="admin-actions">
              {eslesme.tur === "liste-var" ? (
                <Link href={`/admin/listeler/${eslesme.listeId}`} className="btn btn-sm">
                  Listeyi aç
                </Link>
              ) : null}
              <form action={gundemdenTaslakAction} style={{ display: "flex", gap: 6 }}>
                <input type="hidden" name="konu" value={aday.baslik} />
                <select
                  name="kategoriId"
                  defaultValue={kategoriler[0]?.id}
                  style={{ height: 32, width: 130 }}
                  aria-label="Kategori"
                >
                  {kategoriler.map((c) => (
                    <option key={c.id} value={c.id}>{c.emoji} {c.name}</option>
                  ))}
                </select>
                <button
                  className={`btn btn-sm ${eslesme.tur === "yeni" ? "btn-primary" : ""}`}
                  type="submit"
                >
                  Taslak oluştur
                </button>
              </form>
            </div>
          </div>
        ))}

        {!kaynak.hata && gorunen.length === 0 && (
          <p className="admin-empty">Bu süzgeçte aday yok.</p>
        )}

        <p className="form-note">
          Kaynak: Wikipedia Türkçe görüntülenme ölçümleri, {PENCERE_ETIKET[pencere].toLocaleLowerCase("tr")}
          {kaynak.okunanGun > 0 && ` (${kaynak.okunanGun} gün okundu`}
          {kaynak.okunanGun > 0 && kaynak.okunanGun < pencere
            ? `; uzun aralıklarda eşit aralıklı örnekleme yapılır)`
            : kaynak.okunanGun > 0
              ? ")"
              : ""}
          . Ölçümler bir gün gecikmeli yayımlandığı için en yeni gün dışarıda kalır.
          Sonuçlar 30 dakika önbellekte tutulur. &quot;Taslak oluştur&quot; başlığı
          <b> onay bekleyen</b> bir liste olarak açar, doğrudan yayına almaz.
        </p>
      </section>
    </>
  );
}
