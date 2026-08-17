import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { getSessionUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Yönetim",
  robots: { index: false, follow: false },
};

const BOLUMLER: { yol: string; ad: string; ikon: string }[] = [
  { yol: "/admin", ad: "Gösterge Paneli", ikon: "📊" },
  { yol: "/admin/moderasyon", ad: "Moderasyon", ikon: "🛡️" },
  { yol: "/admin/listeler", ad: "Listeler & Maddeler", ikon: "📋" },
  { yol: "/admin/kategoriler", ad: "Kategoriler", ikon: "🗂️" },
  { yol: "/admin/gundem", ad: "Gündemi Tara", ikon: "🔎" },
  { yol: "/admin/icerik", ad: "Hazır İçerik", ikon: "📚" },
  { yol: "/admin/kunye", ad: "Künye Onayı", ikon: "🔍" },
  { yol: "/admin/hero", ad: "Hero Alanı", ikon: "✨" },
  { yol: "/admin/menu", ad: "Mega Menü", ikon: "🗂️" },
  { yol: "/admin/blog", ad: "Blog", ikon: "📝" },
  { yol: "/admin/sayfalar", ad: "Sayfalar", ikon: "📄" },
  { yol: "/admin/bulten", ad: "Bülten", ikon: "✉️" },
  { yol: "/admin/reklam", ad: "Sponsorlar", ikon: "📣" },
  { yol: "/admin/uyeler", ad: "Üyeler", ikon: "👥" },
  { yol: "/admin/istatistik", ad: "İstatistikler", ikon: "📈" },
  { yol: "/admin/ayarlar", ad: "Ayarlar & Kayıtlar", ikon: "⚙️" },
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") {
    redirect("/giris?e=" + encodeURIComponent("Bu bölüm yöneticilere özeldir."));
  }

  return (
    <div className="container admin-kabuk">
      <aside className="admin-yan">
        <div className="admin-yan-baslik">
          <span className="eyebrow">Yönetim</span>
          <b>{user!.username}</b>
        </div>
        <nav>
          {BOLUMLER.map((b) => (
            <Link key={b.yol} href={b.yol} className="admin-yan-link">
              <span aria-hidden="true">{b.ikon}</span>
              {b.ad}
            </Link>
          ))}
        </nav>
        <Link href="/" className="admin-yan-link admin-yan-cikis">
          <span aria-hidden="true">↩</span> Siteye dön
        </Link>
      </aside>
      <div className="admin-icerik">{children}</div>
    </div>
  );
}
