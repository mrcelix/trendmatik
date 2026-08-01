"use client";

import { useState, useTransition } from "react";
import { sifirlamaIsteAction } from "@/lib/actions";

export default function SifirlamaIste() {
  const [gonderildi, setGonderildi] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();

  if (gonderildi) {
    return (
      <p className="alert-ok">
        Bağlantı gönderildi. Gelen kutunu (ve gereksiz e-posta klasörünü) kontrol et.
      </p>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const veri = new FormData(e.currentTarget);
        setHata(null);
        basla(async () => {
          try {
            const s = await sifirlamaIsteAction(veri);
            if (s.ok) setGonderildi(true);
            else setHata(s.hata ?? "Gönderilemedi.");
          } catch {
            setHata("Şu an gönderemedik. Biraz sonra tekrar deneyin.");
          }
        });
      }}
    >
      {hata && <p className="alert-err">{hata}</p>}
      <div className="field">
        <label htmlFor="sifirla-email">E-posta</label>
        <input
          id="sifirla-email"
          name="email"
          type="email"
          required
          autoComplete="email"
          placeholder="ornek@eposta.com"
        />
      </div>
      <button className="btn btn-primary auth-gonder" type="submit" disabled={bekliyor}>
        {bekliyor ? "Gönderiliyor…" : "Sıfırlama bağlantısı gönder"}
      </button>
    </form>
  );
}
