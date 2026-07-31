import type { Metadata } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Inter, Nunito } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { getMenuData } from "@/lib/db";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import MegaMenu from "@/components/MegaMenu";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"], // latin-ext: Türkçe ş, ğ, İ, ı
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["700", "800"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "TrendMatik — Türkiye'nin Trend Sıralamaları",
  description:
    "Türkiye'de trend olan mekan, hizmet, website, konu, ürün ve haberleri 10 maddelik listelerde oyla; gündemi sıralamalarla takip et.",
};

export const dynamic = "force-dynamic";

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const jar = await cookies();
  // Eski sürümlerden kalan tema çerezleri (minimal, gundem…) artık geçersiz
  const TEMALAR = ["gunduz", "gece"];
  const cerez = jar.get("tn_theme")?.value;
  const theme = cerez && TEMALAR.includes(cerez) ? cerez : "gunduz";
  const user = await getSessionUser();
  const menu = await getMenuData();

  return (
    <html lang="tr" data-theme={theme} className={`${inter.variable} ${nunito.variable}`}>
      <body>
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="logo">
              Trend<span className="dot">Matik</span>
            </Link>
            <nav className="header-nav">
              <MegaMenu categories={menu.categories} topics={menu.topics} />
              <Link href="/?sekme=yukselen">🔥 Yükselenler</Link>
              <Link href="/arsiv">🏆 Arşiv</Link>
            </nav>
            <div className="header-right">
              <ThemeSwitcher initial={theme} />
              <Link href="/oner" className="btn btn-sm">
                + Başlık Öner
              </Link>
              {user ? (
                <>
                  <span className="user-chip">
                    <b>{user.username}</b> {user.role === "admin" && <Link href="/admin">(admin)</Link>}
                  </span>
                  <form action={logoutAction} style={{ display: "inline" }}>
                    <button className="btn btn-sm" type="submit">Çıkış</button>
                  </form>
                </>
              ) : (
                <Link href="/giris" className="btn btn-sm btn-primary">
                  Giriş
                </Link>
              )}
            </div>
          </div>
        </header>
        <main className="container">{children}</main>
        <footer className="site-footer">
          <div className="container">
            TrendMatik — Türkiye'nin trend sıralamaları. Üye oyları ×2 sayılır; her maddeye günde bir oy.
          </div>
        </footer>
        <SpeedInsights />
      </body>
    </html>
  );
}
