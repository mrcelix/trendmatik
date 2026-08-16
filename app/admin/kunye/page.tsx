import Link from "next/link";
import { getCategories, gorselOzeti, onerileriGetir, oneriOzeti } from "@/lib/db";
import { gorselTaraAction, kunyeTaraAction, oneriKararAction } from "@/lib/actions";

export const dynamic = "force-dynamic";
// Tarama dış sitelere istek attığı için uzun sürebilir
export const maxDuration = 60;

const DURUMLAR = [
  { id: "bekliyor", ad: "Bekleyen" },
  { id: "onaylandi", ad: "Onaylanan" },
  { id: "reddedildi", ad: "Reddedilen" },
];

export default async function AdminKunyePage({
  searchParams,
}: {
  searchParams: Promise<{
    ok?: string; e?: string; durum?: string; kategori?: string; guven?: string; sayfa?: string;
  }>;
}) {
  const sp = await searchParams;
  const durum = sp.durum ?? "bekliyor";
  const kategori = sp.kategori ?? "";
  const enAzGuven = Number(sp.guven ?? 0) || 0;
  const sayfa = Number(sp.sayfa ?? 0) || 0;

  const [ozet, kategoriler, { satirlar, toplam }, gorsel] = await Promise.all([
    oneriOzeti(),
    getCategories(),
    onerileriGetir({ durum, kategori: kategori || undefined, enAzGuven, limit: 50, sayfa }),
    gorselOzeti(),
  ]);

  const sonSayfa = Math.max(0, Math.ceil(toplam / 50) - 1);
  const kalanTarama = ozet.toplamMadde - ozet.taranan;
  const { gorselli, kuyruk: gorselKuyrugu } = gorsel;
  const adres = (ek: Record<string, string | number>) => {
    const p = new URLSearchParams({ durum, ...(kategori && { kategori }), ...(enAzGuven && { guven: String(enAzGuven) }) });
    for (const [k, v] of Object.entries(ek)) p.set(k, String(v));
    return `/admin/kunye?${p}`;
  };

  return (
    <>
      <div className="page-head">
        <h1>🔍 Künye Onayı</h1>
        <span className="sub">
          {ozet.bekleyen} bekleyen · {ozet.onayli} onaylı · {ozet.reddedilen} reddedildi
        </span>
      </div>

      {sp.ok && <p className="alert-ok">{sp.ok}</p>}
      {sp.e && <p className="alert-err">{sp.e}</p>}

      <div className="admin-kart">
        <h2>Tarama durumu</h2>
        <div className="icerik-sayim">
          <div>
            <b className="font-num">{ozet.taranan.toLocaleString("tr-TR")}</b>
            <span>taranan madde</span>
          </div>
          <div>
            <b className="font-num">{kalanTarama.toLocaleString("tr-TR")}</b>
            <span>kalan</span>
          </div>
          <div>
            <b className="font-num">{ozet.kunyeli.toLocaleString("tr-TR")}</b>
            <span>künyesi olan madde</span>
          </div>
        </div>

        <p className="form-note">
          Tarayıcı, madde adından aday alan adları üretir ve <b>her birine canlı
          istek atar</b>. Yalnızca yanıt veren <i>ve</i> sayfa başlığı marka adını
          içeren adresler öneri olur — alan adının açılması tek başına yeterli
          sayılmaz, park edilmiş olabilir. Öneriler maddeye <b>yazılmaz</b>;
          siz onaylayana kadar burada bekler.
        </p>
        <p className="form-note" style={{ marginTop: 0 }}>
          Her çalıştırma 20 madde işler (sunucusuz süre sınırı). Kalan{" "}
          {kalanTarama.toLocaleString("tr-TR")} madde için düğmeye tekrar tekrar
          basabilirsiniz; tarama kaldığı yerden devam eder. Kavram adları
          (&quot;Aralıklı oruç&quot; gibi) marka olmadığı için aday üretilmeden atlanır.
        </p>

        <form action={kunyeTaraAction}>
          <button className="btn btn-primary" type="submit" disabled={kalanTarama <= 0}>
            {kalanTarama > 0 ? `Sonraki 20 maddeyi tara` : "Tüm maddeler tarandı"}
          </button>
        </form>
      </div>

      {/* --- Görsel taraması --- */}
      <div className="admin-kart" style={{ marginBottom: 18 }}>
        <h2 style={{ marginTop: 0 }}>🖼️ Görsel taraması</h2>

        <div className="admin-kartlar" style={{ marginBottom: 12 }}>
          <div className="admin-kart">
            <b className="font-num">{gorselli.toLocaleString("tr-TR")}</b>
            <span>görseli olan madde</span>
          </div>
          <div className="admin-kart">
            <b className="font-num">{gorselKuyrugu.toLocaleString("tr-TR")}</b>
            <span>taranmayı bekleyen</span>
          </div>
        </div>

        <p className="form-note" style={{ marginTop: 0 }}>
          Maddenin <b>kendi sitesindeki</b> og:image adresini öneri olarak kaydeder —
          marka o görseli zaten paylaşım için yayımlıyor. Görsel kopyalanmaz, yalnızca
          adres saklanır. Öneriler maddeye yazılmaz; aşağıda onayınızı bekler.
        </p>
        <p className="form-note" style={{ marginTop: 0 }}>
          Ön koşul: maddenin <b>site adresi</b> dolu olmalı — onu yukarıdaki künye
          taraması buluyor. Yani sıra şu: önce künye tara, önerileri onayla, sonra
          görselleri tara. Sitesi olmayan maddede çekilecek görsel de yok; onlarda
          harf avatarı görünmeye devam eder.
        </p>

        <form action={gorselTaraAction}>
          <button className="btn btn-primary" type="submit" disabled={gorselKuyrugu <= 0}>
            {gorselKuyrugu > 0
              ? "Sonraki 20 maddenin görselini tara"
              : "Sırada madde yok"}
          </button>
        </form>
      </div>

      {/* --- Süzgeçler --- */}
      <div className="kunye-suzgec">
        {DURUMLAR.map((d) => (
          <Link
            key={d.id}
            href={`/admin/kunye?durum=${d.id}`}
            className={`alt-cip ${durum === d.id ? "aktif" : ""}`}
          >
            {d.ad}
          </Link>
        ))}
        <span className="kunye-ayirac" />
        <Link href={adres({ kategori: "", sayfa: 0 })} className={`alt-cip ${!kategori ? "aktif" : ""}`}>
          Tüm kategoriler
        </Link>
        {kategoriler.map((k) => (
          <Link
            key={k.id}
            href={adres({ kategori: k.slug, sayfa: 0 })}
            className={`alt-cip ${kategori === k.slug ? "aktif" : ""}`}
          >
            {k.emoji} {k.name}
          </Link>
        ))}
        <span className="kunye-ayirac" />
        {[0, 70, 85].map((g) => (
          <Link
            key={g}
            href={adres({ guven: g, sayfa: 0 })}
            className={`alt-cip ${enAzGuven === g ? "aktif" : ""}`}
          >
            {g === 0 ? "Tüm güven" : `Güven ≥ ${g}`}
          </Link>
        ))}
      </div>

      {/* --- Toplu karar --- */}
      {durum === "bekliyor" && satirlar.length > 0 && (
        <form action={oneriKararAction} className="admin-kart" style={{ marginBottom: 14 }}>
          <input type="hidden" name="kapsam" value="hepsi" />
          <input type="hidden" name="enAzGuven" value={85} />
          <p className="form-note" style={{ marginTop: 0 }}>
            <b>Hızlı onay:</b> güveni 85 ve üzeri olan öneriler, sayfa başlığında
            marka adı birebir geçen adreslerdir. Tek tek bakmadan onaylamak
            isterseniz:
          </p>
          <button className="btn" name="karar" value="onayla" type="submit">
            Güveni 85+ olan tüm önerileri onayla
          </button>
        </form>
      )}

      {/* --- Öneri listesi --- */}
      <form action={oneriKararAction}>
        <div className="admin-tablo-sar">
          <table className="admin-tablo">
            <thead>
              <tr>
                <th style={{ width: 34 }}>✓</th>
                <th>Madde</th>
                <th>Önerilen değer</th>
                <th>Kanıt</th>
                <th style={{ width: 70 }}>Güven</th>
              </tr>
            </thead>
            <tbody>
              {satirlar.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input type="checkbox" name="id" value={s.id} style={{ width: "auto" }} aria-label={`${s.maddeAdi} önerisini seç`} />
                  </td>
                  <td>
                    <b>{s.maddeAdi}</b>
                    <div className="dim" style={{ fontSize: 12 }}>
                      <Link href={`/liste/${s.listeSlug}`}>{s.listeBaslik}</Link>
                      {s.sehir && ` · ${s.sehir}`}
                      {s.mevcutDeger && " · ⚠ mevcut değer var, üzerine yazılır"}
                    </div>
                  </td>
                  <td>
                    <a href={s.deger} target="_blank" rel="noopener noreferrer nofollow" className="kunye-oneri-adres">
                      {s.deger}
                    </a>
                    <div className="dim" style={{ fontSize: 11.5 }}>alan: {s.alan}</div>
                  </td>
                  <td className="dim" style={{ fontSize: 11.5, maxWidth: 320 }}>{s.kanit}</td>
                  <td>
                    <span className={`guven-rozet ${s.guven >= 85 ? "yuksek" : s.guven >= 70 ? "orta" : "dusuk"}`}>
                      {s.guven}
                    </span>
                  </td>
                </tr>
              ))}
              {satirlar.length === 0 && (
                <tr>
                  <td colSpan={5} className="dim">
                    {durum === "bekliyor"
                      ? "Bekleyen öneri yok. Yukarıdan tarama çalıştırın."
                      : "Bu süzgeçle kayıt yok."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {durum === "bekliyor" && satirlar.length > 0 && (
          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            <button className="btn btn-primary" name="karar" value="onayla" type="submit">
              Seçilenleri onayla ve yayınla
            </button>
            <button className="btn btn-danger" name="karar" value="reddet" type="submit">
              Seçilenleri reddet
            </button>
          </div>
        )}
      </form>

      {toplam > 50 && (
        <div className="kunye-sayfalama">
          {sayfa > 0 && <Link className="btn btn-sm" href={adres({ sayfa: sayfa - 1 })}>‹ Önceki</Link>}
          <span className="dim">
            Sayfa {sayfa + 1} / {sonSayfa + 1} · {toplam.toLocaleString("tr-TR")} kayıt
          </span>
          {sayfa < sonSayfa && <Link className="btn btn-sm" href={adres({ sayfa: sayfa + 1 })}>Sonraki ›</Link>}
        </div>
      )}
    </>
  );
}
