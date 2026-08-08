import Link from "next/link";
import { getCategories, ozellikAcik } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { suggestTopicAction } from "@/lib/actions";

export const dynamic = "force-dynamic";

export default async function SuggestPage({
  searchParams,
}: {
  searchParams: Promise<{ e?: string; ok?: string; title?: string }>;
}) {
  const { e, ok, title } = await searchParams;
  const user = await getSessionUser();
  const [categories, oneriAcik] = await Promise.all([getCategories(), ozellikAcik("oneri_acik")]);

  // Yönetici kapalıyken de ekleyebilir: başlık yayınlama yolu burası
  if (!oneriAcik && user?.role !== "admin") {
    return (
      <div className="form-card">
        <h1>Başlık Öner</h1>
        <p className="form-note">
          Başlık önerileri şu anda kapalı. Mevcut listeleri{" "}
          <Link href="/" style={{ color: "var(--accent)" }}>ana sayfadan</Link> oylamaya
          devam edebilirsin.
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="form-card">
        <h1>Başlık Öner</h1>
        <p className="form-note">
          Yeni başlık önermek üyelere özeldir.{" "}
          <Link href="/giris" style={{ color: "var(--accent)" }}>Giriş yap</Link> veya{" "}
          <Link href="/kayit" style={{ color: "var(--accent)" }}>üye ol</Link>.
        </p>
      </div>
    );
  }

  return (
    <div className="form-card wide">
      <h1>Yeni Başlık Öner</h1>
      {e && <p className="alert-err">{e}</p>}
      {ok && (
        <p className="alert-ok">
          Önerin alındı! Yönetici onayından sonra yayına girecek. Bir tane daha önerebilirsin.
        </p>
      )}
      <form action={suggestTopicAction}>
        <div className="field">
          <label htmlFor="title">Başlık (örn: "İzmir'de Trend Tatlıcılar")</label>
          <input id="title" name="title" required minLength={8} maxLength={90} defaultValue={title ?? ""} />
        </div>
        <div className="field">
          <label htmlFor="description">Kısa açıklama</label>
          <input id="description" name="description" maxLength={200} />
        </div>
        <div className="field">
          <label htmlFor="categoryId">Kategori</label>
          <select id="categoryId" name="categoryId" required>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.emoji} {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="field">
          <label htmlFor="city">Şehir (isteğe bağlı — yerel listeler için)</label>
          <input id="city" name="city" placeholder="Örn: İstanbul" maxLength={40} />
        </div>
        <div className="field">
          <label htmlFor="items">İlk maddeler — her satıra bir madde (en az 3, en çok 10)</label>
          <textarea id="items" name="items" required placeholder={"Madde 1\nMadde 2\nMadde 3"} />
        </div>
        <button className="btn btn-primary" type="submit">
          {user.role === "admin" ? "Yayınla" : "Öneriyi Gönder"}
        </button>
        <p className="form-note">
          {user.role === "admin"
            ? "Yönetici olduğun için başlık onay beklemeden yayına girer."
            : "Öneriler yönetici onayından geçer. Onaylanan başlık, önerdiğin maddelerle yayına girer ve topluluk oylamasıyla sıralanır."}
        </p>
      </form>
    </div>
  );
}
