"use client";

/**
 * Kök layout'un kendisi patlarsa devreye girer — bu durumda site kabuğu
 * (fontlar, globals.css) yüklenmemiş olabileceği için stiller satır içi.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="tr">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: 24,
          background: "#f7f8fb",
          color: "#16203a",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: 460, textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>⚠️</div>
          <h1 style={{ fontSize: 22, margin: "0 0 10px" }}>TrendMatik şu an açılamıyor</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#5b6478", margin: "0 0 20px" }}>
            Sunucu tarafında bir sorun var. Birkaç dakika içinde tekrar deneyin.
          </p>
          <button
            onClick={reset}
            style={{
              height: 40,
              padding: "0 18px",
              borderRadius: 10,
              border: "none",
              background: "#3a45e0",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Yeniden dene
          </button>
          {error.digest && (
            <p style={{ marginTop: 18, fontSize: 12, color: "#8b93a7" }}>
              Hata kodu: <code>{error.digest}</code>
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
