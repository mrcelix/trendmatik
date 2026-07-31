"use client";

import { useEffect, useState } from "react";

const THEMES = [
  { id: "minimal", label: "◻️ Modern Minimal" },
  { id: "gundem", label: "🔥 Canlı Gündem" },
  { id: "editoryal", label: "📰 Editoryal" },
  { id: "enerjik", label: "⚡ Enerjik" },
] as const;

export default function ThemeSwitcher({ initial }: { initial: string }) {
  const [theme, setTheme] = useState(initial);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.cookie = `tn_theme=${theme}; path=/; max-age=${365 * 86400}; samesite=lax`;
  }, [theme]);

  return (
    <select
      className="theme-switcher"
      value={theme}
      onChange={(e) => setTheme(e.target.value)}
      aria-label="Tema seç"
    >
      {THEMES.map((t) => (
        <option key={t.id} value={t.id}>
          {t.label}
        </option>
      ))}
    </select>
  );
}
