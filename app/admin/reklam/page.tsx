import { reklamlarAdmin } from "@/lib/db";
import { reklamAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function AdminReklamPage({
  searchParams,
}: {
  searchParams: Promise<{ ok?: string; e?: string }>;
}) {
  const { ok, e } = await searchParams;
  const reklamlar = await reklamlarAdmin();
  const aktifSayi = reklamlar.filter((r) => r.aktif === 1).length;
  const toplamTiklama = reklamlar.reduce((t, r) => t + r.tiklama, 0);

  return (
    <>
      <div className="page-head">
        <h1>📣 Sponsorlar</h1>
        <span className="sub">
          {reklamlar.length} kayıt · {aktifSayi} aktif · {toplamTiklama} tıklama
        </span>
      </div>

      {ok && <p className="alert-ok">{ok}</p>}
      {e && <p className="alert-err">{e}</p>}

      <p className="form-note" style={{ marginTop: 0 }}>
        Sponsor kutusu liste sayfalarının sağ sütununda, <b>kare görsel</b> alanıyla
        gösterilir. Birden fazla aktif sponsor varsa gün ve liste bazında dönüşümlü
        çıkarlar. Görsel adresi boş bırakılırsa sponsor adının baş harfleri çizilir.
        Hiç aktif sponsor yoksa kutuda &quot;Markanız burada&quot; çağrısı görünür.
      </p>
      <p className="form-note" style={{ marginTop: 0 }}>
        Tıklamalar <code>/api/reklam/&#123;id&#125;</code> üzerinden sayılır; bağlantılar
        arama motorlarına <code>rel=&quot;sponsored nofollow&quot;</code> ile bildirilir.
        Gösterim sayılmaz — her sayfa açılışında veritabanına yazmak sıralamaları yavaşlatırdı.
      </p>

      {/* --- Yeni sponsor --- */}
      <form action={reklamAction} className="admin-form">
        <input type="hidden" name="islem" value="ekle" />
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="baslik">Sponsor adı</label>
            <input id="baslik" name="baslik" required minLength={2} maxLength={60} placeholder="Örn: Kahve Dünyası" />
          </div>
          <div className="field">
            <label htmlFor="adres">Hedef adres (https)</label>
            <input id="adres" name="adres" type="url" required placeholder="https://ornek.com/kampanya" />
          </div>
        </div>
        <div className="admin-form-satir">
          <div className="field">
            <label htmlFor="gorsel">Kare görsel adresi (isteğe bağlı)</label>
            <input id="gorsel" name="gorsel" type="url" placeholder="https://.../kare-gorsel.jpg" />
          </div>
          <div className="field">
            <label htmlFor="aciklama">Kısa açıklama</label>
            <input id="aciklama" name="aciklama" maxLength={140} placeholder="Tek satır tanıtım" />
          </div>
          <div className="field" style={{ maxWidth: 90 }}>
            <label htmlFor="sira">Sıra</label>
            <input id="sira" name="sira" type="number" min={0} max={99} defaultValue={0} />
          </div>
          <button className="btn btn-primary" type="submit">Sponsor Ekle</button>
        </div>
      </form>

      {/* --- Mevcut sponsorlar --- */}
      <h2 style={{ fontSize: 18, margin: "24px 0 10px" }}>
        Kayıtlı sponsorlar <span className="font-num">({reklamlar.length})</span>
      </h2>

      {reklamlar.length === 0 && (
        <p className="admin-empty">
          Henüz sponsor yok. Liste sayfalarında &quot;Markanız burada&quot; çağrısı gösteriliyor.
        </p>
      )}

      {reklamlar.map((r) => (
        <form action={reklamAction} className="admin-kart" key={r.id} style={{ marginBottom: 12 }}>
          <input type="hidden" name="id" value={r.id} />
          <div className="admin-form-satir">
            <div className="field">
              <label>Sponsor adı</label>
              <input name="baslik" defaultValue={r.baslik} maxLength={60} />
            </div>
            <div className="field">
              <label>Hedef adres</label>
              <input name="adres" type="url" defaultValue={r.adres} />
            </div>
          </div>
          <div className="admin-form-satir">
            <div className="field">
              <label>Kare görsel</label>
              <input name="gorsel" type="url" defaultValue={r.gorsel} placeholder="boş = harf çizilir" />
            </div>
            <div className="field">
              <label>Açıklama</label>
              <input name="aciklama" defaultValue={r.aciklama} maxLength={140} />
            </div>
            <div className="field" style={{ maxWidth: 90 }}>
              <label>Sıra</label>
              <input name="sira" type="number" min={0} max={99} defaultValue={r.sira} />
            </div>
          </div>
          <div className="admin-form-satir" style={{ alignItems: "center" }}>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              <input type="checkbox" name="aktif" defaultChecked={r.aktif === 1} style={{ width: "auto" }} />
              Yayında
            </label>
            <span className="dim" style={{ fontSize: 12.5 }}>
              {r.tiklama} tıklama · {new Date(r.created_at * 1000).toLocaleDateString("tr-TR")}
            </span>
            <button className="btn btn-sm btn-primary" name="islem" value="kaydet" type="submit">
              Kaydet
            </button>
            <button className="btn btn-sm btn-danger" name="islem" value="sil" type="submit">
              Sil
            </button>
          </div>
        </form>
      ))}
    </>
  );
}
