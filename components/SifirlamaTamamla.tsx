"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sifirlamaTamamlaAction } from "@/lib/actions";

/** Parola gücü ölçeri AuthPopup ile aynı kuralları kullanır. */
function parolaGucu(p: string): { seviye: 0 | 1 | 2 | 3; etiket: string } {
  if (p.length < 8) return { seviye: 0, etiket: "Çok kısa" };
  let puan = 0;
  if (/[a-zçğıöşü]/.test(p) && /[A-ZÇĞİÖŞÜ]/.test(p)) puan++;
  if (/\d/.test(p)) puan++;
  if (/[^\w\sçğıöşüÇĞİÖŞÜ]/.test(p)) puan++;
  if (p.length >= 12) puan++;
  if (puan <= 1) return { seviye: 1, etiket: "Zayıf" };
  if (puan <= 2) return { seviye: 2, etiket: "Orta" };
  return { seviye: 3, etiket: "Güçlü" };
}

export default function SifirlamaTamamla({ jeton }: { jeton: string }) {
  const [parola, setParola] = useState("");
  const [goster, setGoster] = useState(false);
  const [hata, setHata] = useState<string | null>(null);
  const [bekliyor, basla] = useTransition();
  const router = useRouter();
  const guc = parolaGucu(parola);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const veri = new FormData(e.currentTarget);
        setHata(null);
        basla(async () => {
          const s = await sifirlamaTamamlaAction(veri);
          if (s.ok) {
            router.replace("/?parola=yenilendi");
            router.refresh();
          } else {
            setHata(s.hata ?? "Sıfırlanamadı.");
          }
        });
      }}
    >
      {hata && <p className="alert-err">{hata}</p>}
      <input type="hidden" name="jeton" value={jeton} />
      <div className="field">
        <label htmlFor="yeni-parola">Yeni parola</label>
        <div className="auth-parola-kutu">
          <input
            id="yeni-parola"
            name="parola"
            type={goster ? "text" : "password"}
            value={parola}
            onChange={(e) => setParola(e.target.value)}
            placeholder="En az 8 karakter"
            autoComplete="new-password"
            required
          />
          <button
            type="button"
            className="auth-goz"
            onClick={() => setGoster((g) => !g)}
            aria-label={goster ? "Parolayı gizle" : "Parolayı göster"}
          >
            {goster ? "🙈" : "👁️"}
          </button>
        </div>
        {parola.length > 0 && (
          <div className="auth-guc">
            <span className={`auth-guc-bar seviye-${guc.seviye}`} />
            <small>{guc.etiket}</small>
          </div>
        )}
      </div>
      <button
        className="btn btn-primary auth-gonder"
        type="submit"
        disabled={bekliyor || parola.length < 8}
      >
        {bekliyor ? "Kaydediliyor…" : "Parolamı güncelle"}
      </button>
    </form>
  );
}
