/* TrendMatik service worker — çevrimdışı yedek sayfa + web push. */

const SURUM = "tm-v1";
const CEVRIMDISI = "/cevrimdisi.html";

self.addEventListener("install", (olay) => {
  olay.waitUntil(
    caches.open(SURUM).then((onbellek) => onbellek.addAll([CEVRIMDISI])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (olay) => {
  olay.waitUntil(
    caches
      .keys()
      .then((anahtarlar) =>
        Promise.all(anahtarlar.filter((a) => a !== SURUM).map((a) => caches.delete(a)))
      )
      .then(() => self.clients.claim())
  );
});

/**
 * Sıralamalar sürekli değiştiği için önbellekten servis etmiyoruz:
 * ağ önce, ağ yoksa yalnızca gezinme isteklerinde çevrimdışı sayfası.
 */
self.addEventListener("fetch", (olay) => {
  const istek = olay.request;
  if (istek.method !== "GET" || istek.mode !== "navigate") return;

  olay.respondWith(
    fetch(istek).catch(() => caches.match(CEVRIMDISI).then((y) => y ?? Response.error()))
  );
});

// ---- Web push ----------------------------------------------------------------

self.addEventListener("push", (olay) => {
  let veri = {};
  try {
    veri = olay.data ? olay.data.json() : {};
  } catch {
    veri = { baslik: "TrendMatik", govde: olay.data ? olay.data.text() : "" };
  }

  const baslik = veri.baslik || "TrendMatik";
  olay.waitUntil(
    self.registration.showNotification(baslik, {
      body: veri.govde || "",
      icon: "/ikon/192.png",
      badge: "/ikon/192.png",
      tag: veri.etiket || "trendmatik",
      data: { yol: veri.yol || "/" },
      // Aynı etiketli bildirim varsa sessizce değiştirilsin
      renotify: false,
    })
  );
});

self.addEventListener("notificationclick", (olay) => {
  olay.notification.close();
  const yol = (olay.notification.data && olay.notification.data.yol) || "/";

  olay.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((pencereler) => {
      // Site zaten açıksa o sekmeyi öne al
      for (const p of pencereler) {
        if (p.url.includes(self.location.origin) && "focus" in p) {
          p.navigate(yol);
          return p.focus();
        }
      }
      return self.clients.openWindow(yol);
    })
  );
});
