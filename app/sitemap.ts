import type { MetadataRoute } from "next";
import { getAllApprovedTopics, getCategories } from "@/lib/db";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

/** Arama motorları için site haritası: sabit sayfalar + kategoriler + listeler. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const taban = siteUrl();
  const simdi = new Date();

  const sabit: MetadataRoute.Sitemap = [
    { url: taban, lastModified: simdi, changeFrequency: "hourly", priority: 1 },
    { url: `${taban}/arsiv`, lastModified: simdi, changeFrequency: "daily", priority: 0.7 },
    // /oner ve /giris robots.txt'te engelli olduğu için haritaya alınmaz
    { url: `${taban}/kayit`, lastModified: simdi, changeFrequency: "monthly", priority: 0.3 },
  ];

  const [kategoriler, basliklar] = await Promise.all([getCategories(), getAllApprovedTopics()]);

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

  return [...sabit, ...kategoriSayfalari, ...listeler];
}
