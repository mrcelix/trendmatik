import Link from "next/link";
import { notFound } from "next/navigation";
import { getCategories, getItemsAdmin, getTopicsAdmin } from "@/lib/db";
import { listeGuncelleAction, maddeYonetAction } from "@/lib/actions";
import MaddeGorseli from "@/components/MaddeGorseli";

export const dynamic = "force-dynamic";

const DURUMLAR = [
  { id: "active", ad: "Listede (Top 10 havuzu)" },
  { id: "candidate", ad: "Aday" },
  { id: "pending", ad: "Onay bekliyor" },
  { id: "rejected", ad: "Reddedildi" },
];

export default async function ListeDuzenlePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { id } = await params;
  const { ok, e } = await searchParams;
  const topicId = Number(id);

  const liste = (await getTopicsAdmin()).find((t) => t.id === topicId);
  if (!liste) notFound();

  const [kategoriler, maddeler] = await Promise.all([getCategories(), getItemsAdmin(topicId)]);
  const aktifler = maddeler.filter((m) => m.status === "active");

  return (
    <>
      <div className="breadcrumb">
        <Link href="/admin/listeler">← Listeler</Link>
      </div>
      <div className="page-head">
        <h1>{liste.title}</h1>
        <Link href={`/liste/${liste.slug}`} className="btn btn-sm" target="_blank">
          Sitede gör ↗
        </Link>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      {/* --- Liste bilgileri --- */}
      <form action={listeGuncelleAction} className="admin-form">
        <input type="hidden" name="id" value={liste.id} />
        <div className="field">
          <label htmlFor="title">Başlık</label>
          <input id="title" name="title" defaultValue={liste.title} maxLength={90} required />
        </div>
        <div className="field">
          <label htmlFor="description">Açıklama</label>
          <input id="description" name="description" defaultValue={liste.description} maxLength={200} />
        </div>
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="category_id">Kategori</label>
            <select id="category_id" name="category_id" defaultValue={liste.category_id}>
              {kategoriler.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.emoji} {c.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="city">Şehir</label>
            <input id="city" name="city" defaultValue={liste.city ?? ""} maxLength={40} />
          </div>
          <div className="field">
            <label htmlFor="status">Durum</label>
            <select id="status" name="status" defaultValue={liste.status}>
              <option value="approved">Yayında</option>
              <option value="pending">Onay bekliyor</option>
              <option value="rejected">Yayından kaldırıldı</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="hero_sira">Hero sırası</label>
            <input
              id="hero_sira"
              name="hero_sira"
              type="number"
              min={0}
              defaultValue={liste.hero_sira}
              title="0 = sıralama yok"
            />
          </div>
        </div>
        <div className="admin-form-satir" style={{ marginTop: 12 }}>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" name="one_cikan" defaultChecked={liste.one_cikan === 1} style={{ width: "auto" }} />
            Hero alanında öne çıkar
          </label>
          <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
            <input type="checkbox" name="menude" defaultChecked={liste.menude === 1} style={{ width: "auto" }} />
            Mega menüde göster
          </label>
          <button className="btn btn-primary" name="islem" value="kaydet" type="submit">
            Kaydet
          </button>
          <button
            className="btn btn-danger"
            name="islem"
            value="sil"
            type="submit"
            title="Liste, maddeleri, oyları ve yorumlarıyla birlikte kalıcı olarak silinir"
          >
            Listeyi sil
          </button>
        </div>
      </form>

      {/* --- Madde ekleme --- */}
      <form action={maddeYonetAction} className="admin-form">
        <input type="hidden" name="topicId" value={liste.id} />
        <input type="hidden" name="islem" value="ekle" />
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="ad">Yeni madde</label>
            <input id="ad" name="ad" placeholder="Madde adı" required minLength={2} maxLength={80} />
          </div>
          <button className="btn btn-primary" type="submit">Madde Ekle</button>
        </div>
      </form>

      {/* --- Maddeler --- */}
      <h2 style={{ fontSize: 18, marginBottom: 10 }}>
        Maddeler <span className="font-num">({maddeler.length})</span>
      </h2>
      <p className="form-note" style={{ marginTop: 0, marginBottom: 12 }}>
        Sıralama normalde oylarla belirlenir. Bir maddeyi belirli bir konuma çakmak istersen
        <b> sabitle</b> kutusunu işaretleyip konum numarası ver (1 = en üst). Sabitlenmemiş maddeler
        kalan boşlukları puan sırasına göre doldurur. Şu an {aktifler.length} madde listede.
      </p>

      <div className="admin-tablo-sar">
        <table className="admin-tablo">
          <thead>
            <tr>
              <th>Madde</th>
              <th>Durum</th>
              <th>Oy</th>
              <th>Sabitle</th>
              <th>Konum</th>
              <th className="sag">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {maddeler.map((m) => (
              <tr key={m.id}>
                <td colSpan={6} style={{ padding: 0 }}>
                  <form
                    action={maddeYonetAction}
                    style={{ display: "grid", gridTemplateColumns: "auto 1fr 170px 60px 80px 90px auto", gap: 8, alignItems: "center", padding: "8px 14px" }}
                  >
                    <input type="hidden" name="topicId" value={liste.id} />
                    <input type="hidden" name="id" value={m.id} />
                    <MaddeGorseli ad={m.name} gorsel={m.gorsel} boyut={32} />
                    <input name="ad" defaultValue={m.name} maxLength={80} style={{ height: 32 }} aria-label="Madde adı" />
                    <select name="durum" defaultValue={m.status} style={{ height: 32 }} aria-label="Durum">
                      {DURUMLAR.map((d) => (
                        <option key={d.id} value={d.id}>{d.ad}</option>
                      ))}
                    </select>
                    <span className="font-num dim" style={{ fontSize: 13 }}>{m.oy}</span>
                    <label style={{ display: "flex", justifyContent: "center" }}>
                      <input type="checkbox" name="sabit" defaultChecked={m.sabit === 1} style={{ width: "auto" }} aria-label="Sabitle" />
                    </label>
                    <input
                      name="elle_sira"
                      type="number"
                      min={0}
                      max={50}
                      defaultValue={m.elle_sira}
                      style={{ height: 32 }}
                      aria-label="Konum"
                    />
                    <span style={{ display: "flex", gap: 4 }}>
                      <button className="btn btn-sm btn-primary" name="islem" value="kaydet" type="submit">
                        Kaydet
                      </button>
                      <button className="btn btn-sm btn-danger" name="islem" value="sil" type="submit">
                        Sil
                      </button>
                    </span>

                    {/* Görsel satırı — tüm sütunları kaplar */}
                    <div className="madde-gorsel-satir">
                      <input
                        name="site"
                        type="url"
                        defaultValue={m.site ?? ""}
                        placeholder="https://maddenin-sitesi.com (isteğe bağlı)"
                        aria-label="Madde web adresi"
                      />
                      <input
                        name="gorsel"
                        type="url"
                        defaultValue={m.gorsel ?? ""}
                        placeholder="https://... görsel adresi"
                        aria-label="Görsel adresi"
                      />
                      <button
                        className="btn btn-sm"
                        name="islem"
                        value="gorsel-cek"
                        type="submit"
                        title="Yukarıdaki web adresinden og:image etiketini çeker"
                      >
                        Siteden çek
                      </button>
                    </div>

                    {/* Künye satırı — listenin kategorisine göre hangi alanların
                        görüneceğini MADDE_ALANLARI belirler; hepsi burada girilir. */}
                    <div className="madde-gorsel-satir">
                      <input
                        name="adres"
                        defaultValue={m.adres ?? ""}
                        maxLength={200}
                        placeholder="Açık adres (mekan/hizmet)"
                        aria-label="Adres"
                      />
                      <input
                        name="telefon"
                        defaultValue={m.telefon ?? ""}
                        maxLength={40}
                        placeholder="Telefon"
                        aria-label="Telefon"
                        style={{ maxWidth: 150 }}
                      />
                      <input
                        name="harita"
                        type="url"
                        defaultValue={m.harita ?? ""}
                        placeholder="Harita adresi (boşsa addan aranır)"
                        aria-label="Harita adresi"
                      />
                      <input
                        name="fiyat"
                        defaultValue={m.fiyat ?? ""}
                        maxLength={40}
                        placeholder="Fiyat"
                        aria-label="Fiyat"
                        style={{ maxWidth: 110 }}
                      />
                    </div>
                  </form>
                </td>
              </tr>
            ))}
            {maddeler.length === 0 && (
              <tr><td colSpan={6} className="dim">Henüz madde yok.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
