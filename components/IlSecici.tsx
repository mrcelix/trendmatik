"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ILLER_ALFABETIK, TUM_TURKIYE, ilSlug } from "@/lib/iller";

/**
 * Üst bardaki il seçici.
 *
 * Varsayılan "Türkiye geneli"; bir il seçilince o ilin sayfasına gidilir.
 * Seçim çerezde tutulur, böylece sonraki ziyaretlerde de aynı il görünür.
 *
 * Listede tüm iller var ama sitede listesi olanlar üstte ayrı bir grupta
 * toplanıyor — 81 ilin çoğunda henüz içerik yok, kullanıcı boş sayfaya
 * gitmesin diye.
 */
export default function IlSecici({
  aktif,
  iceriktekiIller,
}: {
  /** Şu an seçili il; boşsa Türkiye geneli */
  aktif: string;
  /** Sitede en az bir listesi olan iller */
  iceriktekiIller: string[];
}) {
  const [acik, setAcik] = useState(false);
  const [filtre, setFiltre] = useState("");
  const sarmal = useRef<HTMLDivElement>(null);
  const arama = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!acik) return;
    setTimeout(() => arama.current?.focus(), 30);

    const tus = (e: KeyboardEvent) => {
      if (e.key === "Escape") setAcik(false);
    };
    const tikla = (e: MouseEvent) => {
      if (sarmal.current && !sarmal.current.contains(e.target as Node)) setAcik(false);
    };
    document.addEventListener("keydown", tus);
    document.addEventListener("mousedown", tikla);
    return () => {
      document.removeEventListener("keydown", tus);
      document.removeEventListener("mousedown", tikla);
    };
  }, [acik]);

  function sec(il: string) {
    // Bir yıl geçerli; sunucu tarafı bunu okuyup seçili ili gösteriyor
    document.cookie = `tn_il=${encodeURIComponent(il)}; path=/; max-age=${365 * 86400}; samesite=lax`;
    setAcik(false);
    setFiltre("");
    router.push(il === TUM_TURKIYE ? "/" : `/sehir/${ilSlug(il)}`);
    router.refresh();
  }

  const iceriktekiKume = new Set(iceriktekiIller);
  const normalize = (s: string) =>
    s.toLocaleLowerCase("tr").replace(/[çğıöşüâ]/g, (c) =>
      ({ ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a" })[c] ?? c
    );
  const a = normalize(filtre.trim());
  const suz = (liste: string[]) => (a ? liste.filter((i) => normalize(i).includes(a)) : liste);

  const dolu = suz(iceriktekiIller);
  const bos = suz(ILLER_ALFABETIK.filter((i) => !iceriktekiKume.has(i)));

  return (
    <div className="il-secici" ref={sarmal}>
      <button
        className="il-tetik"
        onClick={() => setAcik((o) => !o)}
        aria-expanded={acik}
        aria-haspopup="listbox"
      >
        📍 {aktif || TUM_TURKIYE}
        <span className="il-caret" aria-hidden="true">▾</span>
      </button>

      {acik && (
        <div className="il-panel" role="listbox" aria-label="İl seç">
          <input
            ref={arama}
            className="il-arama"
            value={filtre}
            onChange={(e) => setFiltre(e.target.value)}
            placeholder="İl ara…"
            aria-label="İl ara"
          />

          <button
            className={`il-secenek ${!aktif || aktif === TUM_TURKIYE ? "aktif" : ""}`}
            onClick={() => sec(TUM_TURKIYE)}
          >
            🇹🇷 {TUM_TURKIYE}
          </button>

          {dolu.length > 0 && (
            <>
              <div className="il-baslik">Listesi olan iller</div>
              {dolu.map((il) => (
                <button
                  key={il}
                  className={`il-secenek ${aktif === il ? "aktif" : ""}`}
                  onClick={() => sec(il)}
                >
                  {il}
                </button>
              ))}
            </>
          )}

          {bos.length > 0 && (
            <>
              <div className="il-baslik">Diğer iller</div>
              {bos.map((il) => (
                <button
                  key={il}
                  className={`il-secenek sonuk ${aktif === il ? "aktif" : ""}`}
                  onClick={() => sec(il)}
                >
                  {il}
                </button>
              ))}
            </>
          )}

          {dolu.length === 0 && bos.length === 0 && (
            <div className="il-bos">&quot;{filtre}&quot; ile eşleşen il yok.</div>
          )}
        </div>
      )}
    </div>
  );
}
