import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  const taban = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Yönetim, kimlik ve API uçları indekslenmemeli
        disallow: ["/admin", "/api/", "/giris", "/oner"],
      },
    ],
    sitemap: `${taban}/sitemap.xml`,
    host: taban,
  };
}
