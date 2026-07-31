import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // pg, Node'a özgü modüller içerir; sunucu paketlemesinin dışında tutulur
  serverExternalPackages: ["pg"],
};

export default nextConfig;
