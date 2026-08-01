"use client";

import { useEffect, useState } from "react";

/**
 * Service worker kaydı, "ana ekrana ekle" istemi ve push izni.
 *
 * Hepsi tek bileşende: üçü de aynı tarayıcı yeteneklerine dayanıyor ve
 * kullanıcıya tek bir yerde sunulması daha az rahatsız edici.
 */

type KurulumOlayi = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** base64url VAPID anahtarını pushManager'ın beklediği tampona çevirir. */
function anahtariCevir(base64: string): ArrayBuffer {
  const dolgu = "=".repeat((4 - (base64.length % 4)) % 4);
  const duz = (base64 + dolgu).replace(/-/g, "+").replace(/_/g, "/");
  const ham = atob(duz);
  const tampon = new ArrayBuffer(ham.length);
  const dizi = new Uint8Array(tampon);
  for (let i = 0; i < ham.length; i++) dizi[i] = ham.charCodeAt(i);
  return tampon;
}

export default function PwaKur({
  vapidAnahtar,
  girisYapildi,
}: {
  /** Boşsa push tamamen kapalıdır */
  vapidAnahtar: string;
  girisYapildi: boolean;
}) {
  const pushAcik = vapidAnahtar.length > 0;
  const [kurulumOlayi, setKurulumOlayi] = useState<KurulumOlayi | null>(null);
  const [pushDurumu, setPushDurumu] = useState<"bilinmiyor" | "kapali" | "acik" | "reddedildi">(
    "bilinmiyor"
  );
  const [mesaj, setMesaj] = useState<string | null>(null);

  // Service worker kaydı — push ve çevrimdışı yedek buna bağlı
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Kayıt başarısızsa site normal çalışmaya devam eder
    });
  }, []);

  // Mevcut push aboneliğini oku
  useEffect(() => {
    if (!pushAcik || !("serviceWorker" in navigator) || !("PushManager" in window)) return;
    if (Notification.permission === "denied") {
      setPushDurumu("reddedildi");
      return;
    }
    navigator.serviceWorker.ready
      .then((kayit) => kayit.pushManager.getSubscription())
      .then((abonelik) => setPushDurumu(abonelik ? "acik" : "kapali"))
      .catch(() => setPushDurumu("kapali"));
  }, [pushAcik]);

  // Tarayıcının kurulum istemini yakala; kendi düğmemizle sunuyoruz
  useEffect(() => {
    const yakala = (o: Event) => {
      o.preventDefault();
      setKurulumOlayi(o as KurulumOlayi);
    };
    window.addEventListener("beforeinstallprompt", yakala);
    return () => window.removeEventListener("beforeinstallprompt", yakala);
  }, []);

  async function pushAc() {
    try {
      const izin = await Notification.requestPermission();
      if (izin !== "granted") {
        setPushDurumu(izin === "denied" ? "reddedildi" : "kapali");
        return;
      }
      const kayit = await navigator.serviceWorker.ready;
      const abonelik = await kayit.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: anahtariCevir(vapidAnahtar),
      });
      const cevap = await fetch("/api/push/abone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(abonelik.toJSON()),
      });
      if (!cevap.ok) throw new Error("kayit basarisiz");
      setPushDurumu("acik");
      setMesaj("Bildirimler açıldı. Takip ettiğin listelerde hareket olunca haber vereceğiz.");
    } catch {
      setMesaj("Bildirimler açılamadı. Tarayıcı ayarlarını kontrol edebilirsin.");
    }
  }

  async function pushKapat() {
    try {
      const kayit = await navigator.serviceWorker.ready;
      const abonelik = await kayit.pushManager.getSubscription();
      if (abonelik) {
        await fetch("/api/push/abone", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ endpoint: abonelik.endpoint }),
        });
        await abonelik.unsubscribe();
      }
      setPushDurumu("kapali");
      setMesaj("Bildirimler kapatıldı.");
    } catch {
      setMesaj("Bildirimler kapatılamadı.");
    }
  }

  const kurulumGoster = kurulumOlayi !== null;
  const pushGoster = pushAcik && girisYapildi && pushDurumu !== "bilinmiyor";
  if (!kurulumGoster && !pushGoster && !mesaj) return null;

  return (
    <div className="pwa-kutu">
      {kurulumGoster && (
        <button
          className="btn btn-sm"
          onClick={async () => {
            await kurulumOlayi!.prompt();
            await kurulumOlayi!.userChoice;
            setKurulumOlayi(null);
          }}
        >
          📲 Ana ekrana ekle
        </button>
      )}

      {pushGoster && pushDurumu === "kapali" && (
        <button className="btn btn-sm" onClick={pushAc}>
          🔔 Bildirimleri aç
        </button>
      )}
      {pushGoster && pushDurumu === "acik" && (
        <button className="btn btn-sm" onClick={pushKapat}>
          🔕 Bildirimleri kapat
        </button>
      )}
      {pushGoster && pushDurumu === "reddedildi" && (
        <span className="pwa-not">
          Bildirimler tarayıcı ayarlarından engellenmiş.
        </span>
      )}

      {mesaj && <span className="pwa-not">{mesaj}</span>}
    </div>
  );
}
