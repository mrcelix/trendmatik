"use client";

import { useState, useTransition } from "react";
import { dogrulamaTekrarAction } from "@/lib/actions";

/**
 * Doğrulanmamış e-posta uyarısı. Üye siteyi kullanmaya devam edebilir;
 * şerit yalnızca hatırlatır ve tek tıkla bağlantıyı yeniden gönderir.
 */
export default function DogrulamaSeridi({ email }: { email: string }) {
  const [durum, setDurum] = useState<"bekliyor" | "gonderildi" | "hata">("bekliyor");
  const [mesaj, setMesaj] = useState<string | null>(null);
  const [gonderiliyor, basla] = useTransition();
  const [gizli, setGizli] = useState(false);

  if (gizli) return null;

  return (
    <div className="dogrula-serit">
      <span className="dogrula-metin">
        {durum === "gonderildi" ? (
          <>✅ Bağlantı <b>{email}</b> adresine gönderildi.</>
        ) : durum === "hata" ? (
          <>⚠️ {mesaj}</>
        ) : (
          <>
            ✉️ <b>{email}</b> adresini doğrula — doğrulanan hesaplarda oyun ×2 sayılır.
          </>
        )}
      </span>

      {durum !== "gonderildi" && (
        <button
          className="btn btn-sm"
          disabled={gonderiliyor}
          onClick={() =>
            basla(async () => {
              try {
                const s = await dogrulamaTekrarAction();
                if (s.ok) setDurum("gonderildi");
                else {
                  setMesaj(s.hata ?? "Gönderilemedi.");
                  setDurum("hata");
                }
              } catch {
                setMesaj("Şu an gönderemedik. Biraz sonra tekrar deneyin.");
                setDurum("hata");
              }
            })
          }
        >
          {gonderiliyor ? "Gönderiliyor…" : "Bağlantıyı gönder"}
        </button>
      )}
      <button className="dogrula-kapat" onClick={() => setGizli(true)} aria-label="Kapat">
        ✕
      </button>
    </div>
  );
}
