"use client";

import { useState, useTransition } from "react";
import { bultenKayitAction } from "@/lib/actions";

/**
 * Bülten kayıt formu. Alt bilgide ve /bulten sayfasında kullanılır.
 * Çift onaylı: buradan yalnızca onay e-postası tetiklenir.
 */
export default function BultenForm({ kaynak = "footer" }: { kaynak?: string }) {
  const [durum, setDurum] = useState<"form" | "tamam">("form");
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (durum === "tamam") {
    return (
      <p className="bulten-tamam">
        ✅ Onay bağlantısını gönderdik. E-postandaki düğmeye basınca abonelik başlar.
      </p>
    );
  }

  return (
    <form
      className="bulten-form"
      onSubmit={(e) => {
        e.preventDefault();
        const veri = new FormData(e.currentTarget);
        setHata(null);
        basla(async () => {
          try {
            const s = await bultenKayitAction(veri);
            if (s.ok) setDurum("tamam");
            else setHata(s.hata ?? "Kaydedilemedi.");
          } catch {
            // Sunucu eylemi patlarsa sessiz kalmayalım
            setHata("Şu an kaydedemedik. Biraz sonra tekrar deneyin.");
          }
        });
      }}
    >
      <input type="hidden" name="kaynak" value={kaynak} />
      {/* Bot tuzağı: gerçek kullanıcılar görmez, doldurulursa istek yutulur */}
      <input
        type="text"
        name="website"
        tabIndex={-1}
        autoComplete="off"
        aria-hidden="true"
        className="bulten-tuzak"
      />
      <div className="bulten-satir">
        <input
          type="email"
          name="email"
          required
          placeholder="ornek@eposta.com"
          autoComplete="email"
          aria-label="E-posta adresi"
        />
        <button className="btn btn-primary" type="submit" disabled={bekliyor}>
          {bekliyor ? "…" : "Abone ol"}
        </button>
      </div>
      {hata && <small className="bulten-hata">{hata}</small>}
    </form>
  );
}
