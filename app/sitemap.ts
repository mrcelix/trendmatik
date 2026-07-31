import type { MetadataRoute } from "next";
import { getAllApprovedTopics, getCategories, getSehirler, getYayindakiYazilar } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Arama motorları için site haritası: sabit sayfalar + kategoriler + listeler. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const taban = siteUrl();
  const simdi = new Date();

  const sabit: MetadataRoute.Sitemap = [
    { url: taban, lastModified: simdi, changeFrequency: "hourly", priority: 1 },
    { url: `${taban}/arsiv`, lastModified: simdi, changeFrequency: "daily", priority: 0.7 },
    { url: `${taban}/hafta`, lastModified: simdi, changeFrequency: "daily", priority: 0.7 },
    // /oner ve /giris robots.txt'te engelli olduğu için haritaya alınmaz
    { url: `${taban}/kayit`, lastModified: simdi, changeFrequency: "monthly", priority: 0.3 },
  ];

  const [kategoriler, basliklar, yazilar] = await Promise.all([
    getCategories(),
    getAllApprovedTopics(),
    getYayindakiYazilar(200),
  ]);

  const sehirler = await getSehirler();

  const kategoriSayfalari: MetadataRoute.Sitemap = kategoriler.map((c) => ({
    url: `${taban}/kategori/${c.slug}`,
    lastModified: simdi,
    changeFrequency: "daily",
    priority: 0.8,
  }));

  // Listeler her gün oylarla değiştiği için en yüksek tazelik önceliğinde
  const listeler: MetadataRoute.Sitemap = basliklar.map((t) => ({
    url: `${taban}/liste/${t.slug}`,
    lastModified: simdi,
    changeFrequency: "daily",
    priority: 0.9,
  }));

  const blogSayfalari: MetadataRoute.Sitemap = [
    { url: `${taban}/blog`, lastModified: simdi, changeFrequency: "weekly", priority: 0.6 },
    ...yazilar.map((y) => ({
      url: `${taban}/blog/${y.slug}`,
      lastModified: new Date(y.updated_at * 1000),
      changeFrequency: "monthly" as const,
      priority: 0.6,
    })),
  ];

  const sehirSayfalari: MetadataRoute.Sitemap = [
    { url: `${taban}/sehir`, lastModified: simdi, changeFrequency: "weekly", priority: 0.7 },
    ...sehirler.map((s) => ({
      url: `${taban}/sehir/${s.slug}`,
      lastModified: simdi,
      changeFrequency: "daily" as const,
      priority: 0.8,
    })),
  ];

  return [...sabit, ...kategoriSayfalari, ...listeler, ...blogSayfalari, ...sehirSayfalari];
}
