"use client";

import { useEffect, useState } from "react";

/** 28×28 yuvarlak tema düğmesi: Gündüz ☀️ / Gece 🌙 */
export default function ThemeSwitcher({ initial }: { initial: string }) {
  const [theme, setTheme] = useState(initial === "gece" ? "gece" : "gunduz");

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = `tn_theme=${theme}; path=/; max-age=${365 * 86400}; samesite=lax`;
  }, [theme]);

  const gece = theme === "gece";

  return (
    <button
      className="theme-switcher"
      onClick={() => setTheme(gece ? "gunduz" : "gece")}
      aria-label={gece ? "Gündüz temasına geç" : "Gece temasına geç"}
      title={gece ? "Gündüz teması" : "Gece teması"}
    >
      {gece ? "☀️" : "🌙"}
    </button>
  );
}
