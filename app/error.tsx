"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Sayfa düzeyinde hata sınırı. Sunucu tarafındaki asıl mesaj istemciye
 * sızdırılmaz; Next.js yalnızca bir `digest` verir. O numarayı ekranda
 * gösteriyoruz ki kullanıcı bildirdiğinde sunucu kayıtlarıyla eşleştirebilelim.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(
      JSON.stringify({ seviye: "error", nerede: "istemci:hata-siniri", digest: error.digest ?? null })
    );
  }, [error]);

  return (
    <div className="container">
      <div className="hata-kart">
        <div className="hata-ikon" aria-hidden="true">⚠️</div>
        <h1>Bir şeyler ters gitti</h1>
        <p>
          Bu sayfa yüklenemedi. Sorun bizde — kaydı aldık ve bakıyoruz.
          Sayfayı yeniden denemek genelde işe yarar.
        </p>
        <div className="hata-dugmeler">
          <button className="btn btn-primary" onClick={reset}>
            Yeniden dene
          </button>
          <Link href="/" className="btn">
            Ana sayfaya dön
          </Link>
        </div>
        {error.digest && (
          <p className="hata-kod">
            Hata kodu: <code>{error.digest}</code>
          </p>
        )}
      </div>
    </div>
  );
}
