import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getUserProfile } from "@/lib/db";
import { mutlak } from "@/lib/site";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ kullanici: string }>;
}): Promise<Metadata> {
  const { kullanici } = await params;
  const profil = await getUserProfile(decodeURIComponent(kullanici));
  if (!profil) return {};
  return {
    title: `${profil.user.username} · üye profili`,
    description: `${profil.user.username} kullanıcısının TrendMatik katkıları: ${profil.sayilar.basliklar} liste, ${profil.sayilar.yorumlar} yorum, ${profil.sayilar.oylar} oy.`,
    alternates: { canonical: mutlak(`/uye/${encodeURIComponent(profil.user.username)}`) },
    robots: { index: false }, // profiller arama sonuçlarına girmesin
  };
}

/** Katkı sayısına göre basit rozetler. */
function rozetler(s: { basliklar: number; maddeler: number; yorumlar: number; oylar: number }) {
  const r: { ad: string; ikon: string; aciklama: string }[] = [];
  if (s.oylar >= 1) r.push({ ad: "Oy veren", ikon: "🗳️", aciklama: "Sıralamalara katkı verdi" });
  if (s.oylar >= 50) r.push({ ad: "Sıkı oylayıcı", ikon: "⚡", aciklama: "50+ oy kullandı" });
  if (s.basliklar >= 1) r.push({ ad: "Liste kurucusu", ikon: "📋", aciklama: "Yayınlanan liste açtı" });
  if (s.basliklar >= 5) r.push({ ad: "Kürator", ikon: "🏗️", aciklama: "5+ liste açtı" });
  if (s.yorumlar >= 1) r.push({ ad: "Tartışmacı", ikon: "💬", aciklama: "Yorum yazdı" });
  if (s.yorumlar >= 20) r.push({ ad: "Söz sahibi", ikon: "🎙️", aciklama: "20+ yorum yazdı" });
  return r;
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<{ kullanici: string }>;
}) {
  const { kullanici } = await params;
  const profil = await getUserProfile(decodeURIComponent(kullanici));
  if (!profil) notFound();

  const { user, sayilar, basliklar, yorumlar } = profil;
  const uyelik = new Date(user.created_at * 1000).toLocaleDateString("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const rozet = rozetler(sayilar);

  return (
    <div className="container">
      <div className="breadcrumb">
        <Link href="/">Ana Sayfa</Link> › Üye › {user.username}
      </div>

      <header className="profil-head">
        <span className="profil-avatar" aria-hidden="true">
          {user.username.slice(0, 2).toLocaleUpperCase("tr")}
        </span>
        <div>
          <h1>
            {user.username}
            {user.role === "admin" && <span className="comment-rozet">yönetici</span>}
          </h1>
          <p className="profil-alt">{uyelik} tarihinden beri üye · üye oyları ×2 sayılır</p>
        </div>
      </header>

      <div className="profil-sayilar">
        {[
          { ad: "Kullanılan oy", deger: sayilar.oylar },
          { ad: "Açılan liste", deger: sayilar.basliklar },
          { ad: "Önerilen madde", deger: sayilar.maddeler },
          { ad: "Yorum", deger: sayilar.yorumlar },
        ].map((k) => (
          <div className="profil-sayi" key={k.ad}>
            <b className="font-num">{k.deger.toLocaleString("tr-TR")}</b>
            <span>{k.ad}</span>
          </div>
        ))}
      </div>

      {rozet.length > 0 && (
        <section className="section">
          <div className="section-head">
            <span className="eyebrow">Kazanımlar</span>
            <h2>Rozetler</h2>
          </div>
          <div className="rozet-satiri">
            {rozet.map((r) => (
              <span className="rozet" key={r.ad} title={r.aciklama}>
                <span aria-hidden="true">{r.ikon}</span> {r.ad}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Katkılar</span>
          <h2>Açtığı listeler</h2>
        </div>
        {basliklar.length === 0 && <p className="admin-empty">Henüz yayınlanan listesi yok.</p>}
        {basliklar.map((b) => (
          <div className="admin-row" key={b.slug}>
            <div className="grow">
              <Link href={`/liste/${b.slug}`}>
                <b>{b.title}</b>
              </Link>
              <div className="dim">
                {new Date(b.created_at * 1000).toLocaleDateString("tr-TR")}
              </div>
            </div>
          </div>
        ))}
      </section>

      <section className="section">
        <div className="section-head">
          <span className="eyebrow">Tartışma</span>
          <h2>Son yorumları</h2>
        </div>
        {yorumlar.length === 0 && <p className="admin-empty">Henüz yorum yazmamış.</p>}
        {yorumlar.map((y) => (
          <div className="admin-row" key={y.id}>
            <div className="grow">
              <div className="dim">
                <Link href={`/liste/${y.topicSlug}#yorumlar`}>{y.topicTitle}</Link> ·{" "}
                {new Date(y.created_at * 1000).toLocaleDateString("tr-TR")}
              </div>
              <div>{y.body.slice(0, 220)}{y.body.length > 220 ? "…" : ""}</div>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
