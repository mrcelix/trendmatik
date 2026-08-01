"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { girisAction, kayitAction } from "@/lib/actions";

/**
 * Giriş / kayıt penceresi.
 * Arama penceresiyle aynı kalıp: body'ye taşınır (üst bardaki backdrop-filter
 * fixed çocukları hapsettiği için), arka planı bulanıklaştırır, Esc ile kapanır.
 */

const EPOSTA_KALIBI = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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

export default function AuthPopup({
  googleAcik,
  acilisSekmesi = "giris",
  tetikSinifi = "btn btn-sm btn-outline",
  tetikMetni,
}: {
  googleAcik: boolean;
  acilisSekmesi?: "giris" | "kayit";
  tetikSinifi?: string;
  tetikMetni?: React.ReactNode;
}) {
  const [acik, setAcik] = useState(false);
  const [bagli, setBagli] = useState(false);
  const [sekme, setSekme] = useState<"giris" | "kayit">(acilisSekmesi);
  const [hata, setHata] = useState<string | null>(null);
  const [parolaGoster, setParolaGoster] = useState(false);
  const [email, setEmail] = useState("");
  const [parola, setParola] = useState("");
  const [ad, setAd] = useState("");
  const [gonderiliyor, basla] = useTransition();

  const ilkAlan = useRef<HTMLInputElement>(null);
  const router = useRouter();

  useEffect(() => setBagli(true), []);

  useEffect(() => {
    if (!acik) return;
    const eski = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => ilkAlan.current?.focus(), 30);
    return () => {
      document.body.style.overflow = eski;
    };
  }, [acik]);

  function kapat() {
    setAcik(false);
    setHata(null);
    setParola("");
  }

  function sekmeDegistir(yeni: "giris" | "kayit") {
    setSekme(yeni);
    setHata(null);
    setTimeout(() => ilkAlan.current?.focus(), 20);
  }

  const epostaGecerli = email.length === 0 || EPOSTA_KALIBI.test(email);
  const guc = parolaGucu(parola);
  const kayitHazir = EPOSTA_KALIBI.test(email) && parola.length >= 8;
  const girisHazir = email.length > 0 && parola.length > 0;

  function gonder(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const veri = new FormData(e.currentTarget);
    setHata(null);
    basla(async () => {
      const sonuc = sekme === "giris" ? await girisAction(veri) : await kayitAction(veri);
      if (sonuc.ok) {
        kapat();
        router.refresh();
      } else {
        setHata(sonuc.hata ?? "Bir şeyler ters gitti.");
      }
    });
  }

  return (
    <>
      <button
        className={tetikSinifi}
        onClick={() => {
          setSekme(acilisSekmesi);
          setAcik(true);
        }}
      >
        {tetikMetni ?? (
          <>
            Giriş<span className="sadece-masaustu"> Yap / Üye Ol</span>
          </>
        )}
      </button>

      {acik &&
        bagli &&
        createPortal(
          <div
            className="ara-katman"
            onClick={kapat}
            onKeyDown={(e) => {
              if (e.key === "Escape") {
                e.stopPropagation();
                kapat();
              }
            }}
          >
            <div
              className="auth-pencere"
              role="dialog"
              aria-label={sekme === "giris" ? "Giriş yap" : "Üye ol"}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="auth-sekmeler">
                <button
                  className={`auth-sekme ${sekme === "giris" ? "aktif" : ""}`}
                  onClick={() => sekmeDegistir("giris")}
                  type="button"
                >
                  Giriş Yap
                </button>
                <button
                  className={`auth-sekme ${sekme === "kayit" ? "aktif" : ""}`}
                  onClick={() => sekmeDegistir("kayit")}
                  type="button"
                >
                  Üye Ol
                </button>
                <button className="auth-kapat" onClick={kapat} aria-label="Kapat">
                  ✕
                </button>
              </div>

              <div className="auth-govde">
                <p className="auth-slogan">
                  {sekme === "giris"
                    ? "Oyların ×2 sayılsın, listeleri takip et."
                    : "Üye ol: oyun ×2 sayılsın, liste öner, tahmin oyna."}
                </p>

                {googleAcik && (
                  <>
                    <a className="auth-google" href="/api/auth/google">
                      <span className="auth-g" aria-hidden="true">G</span>
                      Google ile {sekme === "giris" ? "giriş yap" : "üye ol"}
                    </a>
                    <div className="auth-ayrac"><span>veya e-posta ile</span></div>
                  </>
                )}

                {hata && <p className="alert-err">{hata}</p>}

                <form onSubmit={gonder}>
                  <div className="field">
                    <label htmlFor="auth-email">E-posta</label>
                    <input
                      id="auth-email"
                      name="email"
                      type="email"
                      ref={ilkAlan}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ornek@eposta.com"
                      autoComplete="email"
                      required
                      style={!epostaGecerli ? { borderColor: "var(--down)" } : undefined}
                    />
                    {!epostaGecerli && (
                      <small className="auth-uyari">E-posta adresi eksik görünüyor.</small>
                    )}
                  </div>

                  {sekme === "kayit" && (
                    <div className="field">
                      <label htmlFor="auth-ad">Görünen ad (isteğe bağlı)</label>
                      <input
                        id="auth-ad"
                        name="ad"
                        value={ad}
                        onChange={(e) => setAd(e.target.value)}
                        placeholder="Boş bırakırsan e-postandan üretilir"
                        maxLength={24}
                        autoComplete="nickname"
                      />
                    </div>
                  )}

                  <div className="field">
                    <label htmlFor="auth-parola">Parola</label>
                    <div className="auth-parola-kutu">
                      <input
                        id="auth-parola"
                        name="parola"
                        type={parolaGoster ? "text" : "password"}
                        value={parola}
                        onChange={(e) => setParola(e.target.value)}
                        placeholder={sekme === "kayit" ? "En az 8 karakter" : "Parolan"}
                        autoComplete={sekme === "kayit" ? "new-password" : "current-password"}
                        required
                      />
                      <button
                        type="button"
                        className="auth-goz"
                        onClick={() => setParolaGoster((g) => !g)}
                        aria-label={parolaGoster ? "Parolayı gizle" : "Parolayı göster"}
                      >
                        {parolaGoster ? "🙈" : "👁️"}
                      </button>
                    </div>

                    {sekme === "kayit" && parola.length > 0 && (
                      <div className="auth-guc">
                        <span className={`auth-guc-bar seviye-${guc.seviye}`} />
                        <small>{guc.etiket}</small>
                      </div>
                    )}

                    {sekme === "giris" && (
                      <div className="auth-unuttum">
                        <Link href="/sifirla" onClick={kapat}>
                          Parolamı unuttum
                        </Link>
                      </div>
                    )}
                  </div>

                  <button
                    className="btn btn-primary auth-gonder"
                    type="submit"
                    disabled={gonderiliyor || (sekme === "kayit" ? !kayitHazir : !girisHazir)}
                  >
                    {gonderiliyor
                      ? "Gönderiliyor…"
                      : sekme === "giris"
                        ? "Giriş Yap"
                        : "Hesabımı Oluştur"}
                  </button>
                </form>

                <p className="auth-alt">
                  {sekme === "giris" ? (
                    <>
                      Hesabın yok mu?{" "}
                      <button type="button" onClick={() => sekmeDegistir("kayit")}>
                        Üye ol
                      </button>
                    </>
                  ) : (
                    <>
                      Zaten üye misin?{" "}
                      <button type="button" onClick={() => sekmeDegistir("giris")}>
                        Giriş yap
                      </button>
                    </>
                  )}
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
