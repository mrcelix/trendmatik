import Link from "next/link";
import { getCategories, getTopicsAdmin, icerikSayimi } from "@/lib/db";
import { HAZIR_ICERIK, icerikOzeti } from "@/lib/icerik";
import { icerikYukleAction, taslaklariYayinlaAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
// Toplu yükleme uzun sürebilir; sunucusuz varsayılan 10 sn yetmiyor.
export const maxDuration = 60;

export default async function AdminIcerikPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string; onizle?: string }>;
}) {
  const { ok, e, onizle } = await searchParams;
  const ozet = icerikOzeti();
  const kategoriler = await getCategories();
  const kategoriAdi = new Map(kategoriler.map((k) => [k.slug, `${k.emoji} ${k.name}`]));

  const mevcut = await getTopicsAdmin();
  const mevcutSluglar = new Set(mevcut.map((t) => t.slug));
  const sayim = await icerikSayimi();

  const toplamListe = ozet.reduce((t, o) => t + o.liste, 0);
  const toplamMadde = ozet.reduce((t, o) => t + o.madde, 0);

  // Önizleme: seçilen kategorinin ilk 12 listesi
  const onizlemeKategori = onizle
    ? HAZIR_ICERIK.find((k) => k.kategori === onizle)
    : undefined;

  return (
    <>
      <div className="page-head">
        <h1>📚 Hazır İçerik Kütüphanesi</h1>
        <span className="sub">
          {toplamListe} liste · {toplamMadde.toLocaleString("tr-TR")} madde
        </span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <div className="admin-kart" style={{ marginBottom: 18 }}>
        <h2>Sitedeki durum</h2>
        <div className="icerik-sayim">
          <div>
            <b className="font-num">{sayim.yayinda.toLocaleString("tr-TR")}</b>
            <span>yayında</span>
          </div>
          <div>
            <b className="font-num">{sayim.taslak.toLocaleString("tr-TR")}</b>
            <span>taslak (sitede görünmez)</span>
          </div>
          <div>
            <b className="font-num">{sayim.madde.toLocaleString("tr-TR")}</b>
            <span>madde</span>
          </div>
        </div>

        {sayim.taslak > 0 && (
          <>
            <p className="form-note">
              Taslaktaki listeler sitede <b>görünmez</b>. Yayına almak için:
            </p>
            <form action={taslaklariYayinlaAction} style={{ display: "inline-flex", gap: 8, flexWrap: "wrap" }}>
              <input type="hidden" name="kategori" value="hepsi" />
              <button className="btn btn-primary" type="submit">
                {sayim.taslak.toLocaleString("tr-TR")} taslağın tümünü yayına al
              </button>
            </form>
          </>
        )}
      </div>

      <p className="form-note" style={{ marginTop: 0 }}>
        Kütüphane koda gömülüdür ve yükleme <b>etkisiz-tekrarlanabilirdir</b>:
        aynı adrese (slug) sahip bir liste zaten varsa atlanır, elle
        düzenlediğin listelerin üzerine yazılmaz. Bu yüzden dilediğin kadar
        çalıştırabilirsin.
      </p>
      <p className="form-note" style={{ marginTop: 0 }}>
        <b>Taslak olarak yüklemen önerilir.</b> 600'den fazla listeyi aynı anda
        yayına almak arama motorlarında ince içerik riski yaratır; taslakları
        <Link href="/admin/moderasyon"> moderasyon</Link> ekranından
        gruplar hâlinde yayına alabilirsin.
      </p>

      <div className="admin-tablo-sar">
        <table className="admin-tablo">
          <thead>
            <tr>
              <th>Kategori</th>
              <th>Liste</th>
              <th>Madde</th>
              <th>Sitede var</th>
              <th className="sag">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {ozet.map((o) => {
              const kutuphane = HAZIR_ICERIK.find((k) => k.kategori === o.kategori)!;
              const varOlan = kutuphane.listeler.filter((l) =>
                mevcutSluglar.has(slugBenzeri(l.t))
              ).length;
              return (
                <tr key={o.kategori}>
                  <td>
                    <b>{kategoriAdi.get(o.kategori) ?? o.kategori}</b>
                    <div className="dim" style={{ fontSize: 12 }}>
                      {[...new Set(kutuphane.listeler.map((l) => l.a))].length} alt kategori
                    </div>
                  </td>
                  <td className="font-num">{o.liste}</td>
                  <td className="font-num">{o.madde}</td>
                  <td className="font-num dim">{varOlan}</td>
                  <td className="sag">
                    <span style={{ display: "inline-flex", gap: 6 }}>
                      <Link href={`/admin/icerik?onizle=${o.kategori}`} className="btn btn-sm">
                        Önizle
                      </Link>
                      <form action={icerikYukleAction} style={{ display: "inline" }}>
                        <input type="hidden" name="kategori" value={o.kategori} />
                        <input type="hidden" name="durum" value="pending" />
                        <button className="btn btn-sm btn-primary" type="submit">
                          Taslak yükle
                        </button>
                      </form>
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="admin-kart" style={{ marginTop: 20 }}>
        <h2>Tümünü yükle</h2>
        <p className="form-note" style={{ marginTop: 0 }}>
          Altı kategorinin tamamı tek seferde yüklenir. Postgres üzerinde
          {" "}{toplamListe} liste + {toplamMadde.toLocaleString("tr-TR")} madde
          eklendiği için işlem birkaç dakika sürebilir.
        </p>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <form action={icerikYukleAction}>
            <input type="hidden" name="kategori" value="hepsi" />
            <input type="hidden" name="durum" value="pending" />
            <button className="btn btn-primary" type="submit">
              Tümünü taslak olarak yükle
            </button>
          </form>
          <form action={icerikYukleAction}>
            <input type="hidden" name="kategori" value="hepsi" />
            <input type="hidden" name="durum" value="approved" />
            <button
              className="btn"
              type="submit"
              title="Tüm listeler onaysız yayına girer — SEO açısından önerilmez"
            >
              Tümünü doğrudan yayına al
            </button>
          </form>
        </div>
      </div>

      {onizlemeKategori && (
        <div className="admin-kart" style={{ marginTop: 20 }}>
          <h2>
            Önizleme — {kategoriAdi.get(onizlemeKategori.kategori) ?? onizlemeKategori.kategori}
          </h2>
          <p className="form-note" style={{ marginTop: 0 }}>
            İlk 12 liste gösteriliyor (toplam {onizlemeKategori.listeler.length}).
          </p>
          {onizlemeKategori.listeler.slice(0, 12).map((l) => (
            <div className="admin-row" key={l.t}>
              <div className="grow">
                <b>{l.t}</b>
                {mevcutSluglar.has(slugBenzeri(l.t)) && (
                  <span className="comment-rozet" style={{ marginLeft: 6 }}>zaten var</span>
                )}
                <div className="dim" style={{ fontSize: 12.5 }}>
                  {l.a}
                  {l.c && ` · ${l.c}`} · {l.m.slice(0, 4).join(", ")}…
                </div>
              </div>
            </div>
          ))}
          <Link href="/admin/icerik" className="btn btn-sm" style={{ marginTop: 10 }}>
            Önizlemeyi kapat
          </Link>
        </div>
      )}
    </>
  );
}

/**
 * Sunucudaki slugify ile aynı kuralları uygular — yalnızca "zaten var mı"
 * göstergesi için. Gerçek slug üretimi yükleme sırasında lib/db.ts'te yapılır.
 */
function slugBenzeri(text: string): string {
  const harf: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
    Ç: "c", Ğ: "g", İ: "i", I: "i", Ö: "o", Ş: "s", Ü: "u",
  };
  return text
    .replace(/[çğıöşüÇĞİIÖŞÜ]/g, (c) => harf[c] ?? c)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
