import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { cookies } from "next/headers";
import { Inter, Nunito, JetBrains_Mono } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import "./globals.css";
import { countUnread, getMenuData } from "@/lib/db";
import { siteUrl } from "@/lib/site";
import { getSessionUser } from "@/lib/auth";
import { logoutAction } from "@/lib/actions";
import ThemeSwitcher from "@/components/ThemeSwitcher";
import MegaMenu from "@/components/MegaMenu";
import HeaderSearch from "@/components/HeaderSearch";
import OlayTakip from "@/components/OlayTakip";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"], // latin-ext: Türkçe ş, ğ, İ, ı
  display: "swap",
});

const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["600", "700", "800", "900"],
  display: "swap",
});

// Sayısal değerler (puan, sıra, sayaç) için tabular mono
const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600"],
  display: "swap",
});

const ACIKLAMA =
  "Türkiye'de trend olan mekan, hizmet, website, konu, ürün ve haberleri 10 maddelik listelerde oyla; gündemi sıralamalarla takip et.";

export const metadata: Metadata = {
  // Göreli yollar (OG görselleri dahil) bu adrese göre mutlaklaştırılır
  metadataBase: new URL(siteUrl()),
  title: {
    default: "TrendMatik — Türkiye'nin Trend Sıralamaları",
    template: "%s — TrendMatik",
  },
  description: ACIKLAMA,
  applicationName: "TrendMatik",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "TrendMatik",
    locale: "tr_TR",
    title: "TrendMatik — Türkiye'nin Trend Sıralamaları",
    description: ACIKLAMA,
    url: siteUrl(),
  },
  twitter: { card: "summary_large_image", title: "TrendMatik", description: ACIKLAMA },
  robots: { index: true, follow: true },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0b1120" },
  ],
};

export const dynamic = "force-dynamic";

const sayi = (n: number) => n.toLocaleString("tr-TR");

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
  const s = menu.stats;
  const okunmamis = user ? await countUnread(user.id) : 0;

  const guvenSeridi = [
    `📋 ${sayi(s.listeler)} liste`,
    `🗳️ ${sayi(s.oylar)} oy kullanıldı`,
    `🔥 bugün ${sayi(s.bugunOy)} oy`,
    `🗂️ ${sayi(s.kategoriler)} kategori`,
    `⚡ üye oyu ×2 sayılır`,
    `📈 sıralamalar her gün güncellenir`,
  ];

  return (
    <html
      lang="tr"
      data-theme={theme}
      className={`${inter.variable} ${nunito.variable} ${jetbrains.variable}`}
    >
      <body>
        {/* 1. kat: yardımcı şerit */}
        <div className="utilbar">
          <div className="utilbar-inner">
            <div className="utilbar-left">
              <span>📍 Türkiye geneli</span>
              <span className="utilbar-sep" aria-hidden="true" />
              <Link href="/oner">💡 Liste fikrin mi var?</Link>
            </div>
            <div className="utilbar-right">
              <ThemeSwitcher initial={theme} />
            </div>
          </div>
        </div>

        {/* 2. kat: ana başlık */}
        <header className="site-header">
          <div className="header-inner">
            <Link href="/" className="logo">
              Trend<span className="dot">Matik</span>
            </Link>
            <MegaMenu categories={menu.categories} topics={menu.topics} />
            <HeaderSearch topics={menu.topics} items={menu.items} />
            <nav className="header-icons">
              <Link href="/?sekme=yukselen" title="Yükselenler">🔥</Link>
              <Link href="/arsiv" title="Zirve arşivi">🏆</Link>
              <Link href="/blog" title="Blog">📝</Link>
              {user && (
                <Link href="/bildirimler" title="Bildirimler" className="zil">
                  🔔
                  {okunmamis > 0 && (
                    <span className="zil-sayac">{okunmamis > 99 ? "99+" : okunmamis}</span>
                  )}
                </Link>
              )}
            </nav>
            <Link href="/oner" className="btn btn-cta btn-shine" title="Başlık öner">
              ✨<span className="sadece-masaustu">Başlık Öner</span>
            </Link>
            {user ? (
              <div className="header-user">
                <Link
                  href={`/uye/${encodeURIComponent(user.username)}`}
                  className="avatar"
                  title={`${user.username} — profilim`}
                >
                  {user.username.slice(0, 2).toLocaleUpperCase("tr")}
                </Link>
                {user.role === "admin" && (
                  <Link href="/admin" className="btn btn-sm sadece-masaustu">
                    Yönetim
                  </Link>
                )}
                <form action={logoutAction} style={{ display: "inline" }}>
                  <button className="btn btn-sm sadece-masaustu" type="submit">
                    Çıkış
                  </button>
                </form>
              </div>
            ) : (
              <Link href="/giris" className="btn btn-sm btn-outline">
                Giriş<span className="sadece-masaustu"> Yap / Üye Ol</span>
              </Link>
            )}
          </div>
        </header>

        {/* 3. kat: güven şeridi — kesintisiz döngü için şerit iki kez klonlanır */}
        <div className="trustbar trust-shine">
          <div className="trustbar-track">
            {[0, 1].map((klon) =>
              guvenSeridi.map((t, i) => (
                <span key={`${klon}-${i}`} className="trust-item" aria-hidden={klon === 1}>
                  {t}
                </span>
              ))
            )}
          </div>
        </div>

        {/* Konteyner sayfa içinde uygulanır; hero gibi tam genişlik bölümler
            böylece kenarlara yaslanabiliyor. */}
        <main>{children}</main>

        <footer className="site-footer">
          <div className="container">
            TrendMatik — Türkiye'nin trend sıralamaları. Üye oyları ×2 sayılır; her maddeye günde bir oy.
          </div>
        </footer>
        <OlayTakip />
        <SpeedInsights />
      </body>
    </html>
  );
}
