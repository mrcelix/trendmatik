import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TrendMatik — Türkiye'nin Trend Sıralamaları",
    short_name: "TrendMatik",
    description:
      "Türkiye'de trend olan mekan, hizmet, website, konu, ürün ve haberleri 10 maddelik listelerde oyla.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#ffffff",
    theme_color: "#3a45e0",
    lang: "tr",
    dir: "ltr",
    categories: ["news", "social", "lifestyle"],
    icons: [
      { src: "/ikon/192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/ikon/512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/ikon/maskeli.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Yükselenler", url: "/?sekme=yukselen" },
      { name: "Bu hafta", url: "/hafta" },
      { name: "Liste öner", url: "/oner" },
    ],
  };
}
