"use server";

import { redirect } from "next/navigation";
import { revalidatePath, updateTag } from "next/cache";
import {
  addComment, addNotification, benzersizGorunenAd, createItemSuggestion, createTopicSuggestion,
  createUser,
  getCategories, getCommentById, getItemOwnerAndTopic, getTopicBoard, getTopicById,
  getTopicBySlug, getTopicOwner,
  addItemAdmin, createBlogYazi, createCategory, deleteBlogYazi, deleteCategory, deleteItem,
  deleteTopic, denetimKaydi, getBlogYaziById, updateBlogYazi,
  getCategoriesAdmin, getDuelloSayisi, getTopicsAdmin, getUserByEmail,
  epostaDogrulandiIsaretle, jetonOlustur, jetonSayisi, jetonTuket, parolaGuncelle,
  bultenKaydet, icerikYukle, icerikSayimi, taslaklariYayinla, kunyeUygula,
  onerileriGetir, onerileriKararaBagla,
  reklamEkle, reklamGuncelle, reklamSil,
  GUNLUK_DUELLO_SINIRI, hideComment,
  HERO_KATEGORI_EN_COK, HERO_KATEGORI_VARSAYILAN, ICERIK_ETIKETI,
  markAllRead, ozellikAcik, recordDuel, saveRerank, setItemStatus, setTopicStatus, updateCategory,
  updateItem, updateTopic, YORUM_MAX,
  adminSayisi, duyuruGonder, getUserById, setSetting, tahminKaydet, takipDegistir, updateUser,
} from "./db";
import {
  clearSessionCookie, getSessionUser, getVoterIdentity, hashPassword, jetonOzeti,
  jetonUret, setSessionCookie, verifyPassword,
} from "./auth";
import {
  bultenOnaySablonu, dogrulamaSablonu, epostaGonder, sifirlamaSablonu,
  type EpostaSonuc,
} from "./eposta";
import { siteUrl } from "./site";
import { gorselTemizle, ogGorselCek } from "./gorsel";

// ---- Üyelik -------------------------------------------------------------------

export type AuthSonuc = { ok: boolean; hata?: string; alan?: "email" | "parola" | "ad" };

const EPOSTA_KALIBI = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/**
 * Kayıt — e-posta tabanlı. Popup içinden çağrıldığı için yönlendirme yerine
 * sonuç nesnesi döner; hata mesajı formun içinde gösterilir.
 */
export async function kayitAction(formData: FormData): Promise<AuthSonuc> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parola = String(formData.get("parola") ?? "");
  const ad = String(formData.get("ad") ?? "").trim();

  if (!EPOSTA_KALIBI.test(email)) {
    return { ok: false, hata: "Geçerli bir e-posta adresi girin.", alan: "email" };
  }
  if (parola.length < 8) {
    return { ok: false, hata: "Parola en az 8 karakter olmalı.", alan: "parola" };
  }
  if (await getUserByEmail(email)) {
    return { ok: false, hata: "Bu e-posta ile zaten bir hesap var. Giriş yapmayı deneyin.", alan: "email" };
  }

  const gorunenAd = await benzersizGorunenAd(ad || email.split("@")[0]);
  const id = await createUser({ email, username: gorunenAd, passHash: hashPassword(parola) });
  await setSessionCookie(id);
  // Oturum hemen açılır; doğrulama e-postası arka planda gider. Gönderim
  // başarısız olsa bile kayıt tamamlanmış sayılır (üye sonradan tekrar isteyebilir).
  await dogrulamaGonder(id, email);
  revalidatePath("/", "layout");
  // Veri önbelleği rota önbelleğinden ayrı; etiket olmadan 60 sn beklerdi.
  // updateTag: server action içinden çağrılınca değişiklik anında görünür.
  updateTag(ICERIK_ETIKETI);
  return { ok: true };
}

/** Doğrulama jetonu üretip e-postayı yollar. Kısa aralıklı tekrarları frenler. */
export async function dogrulamaGonder(userId: number, email: string): Promise<EpostaSonuc> {
  // Saatte en fazla 3 doğrulama e-postası
  if (await jetonSayisi(userId, "dogrula", 3600) >= 3) {
    return { ok: false, hata: "Çok fazla istek gönderildi. Bir saat sonra tekrar deneyin." };
  }
  const { ham, ozet } = jetonUret();
  await jetonOlustur(userId, "dogrula", ozet, 24 * 3600);
  const adres = `${siteUrl()}/api/hesap/dogrula?t=${ham}`;
  return epostaGonder({ kime: email, ...dogrulamaSablonu(adres) });
}

/** Giriş yapmış üyenin "doğrulama bağlantısını tekrar gönder" isteği. */
export async function dogrulamaTekrarAction(): Promise<AuthSonuc> {
  const user = await getSessionUser();
  if (!user) return { ok: false, hata: "Önce giriş yapın." };
  if (Number(user.eposta_dogrulandi ?? 0) === 1) return { ok: true };

  const sonuc = await dogrulamaGonder(user.id, user.email);
  if (sonuc.kapali) {
    return { ok: false, hata: "E-posta gönderimi henüz yapılandırılmadı. Yöneticiyle iletişime geçin." };
  }
  return sonuc.ok ? { ok: true } : { ok: false, hata: sonuc.hata ?? "Gönderilemedi." };
}

/**
 * Parola sıfırlama isteği. Adresin kayıtlı olup olmadığını ele vermez —
 * her durumda aynı yanıt döner (hesap sayımı saldırısına karşı).
 */
export async function sifirlamaIsteAction(formData: FormData): Promise<AuthSonuc> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!EPOSTA_KALIBI.test(email)) {
    return { ok: false, hata: "Geçerli bir e-posta adresi girin.", alan: "email" };
  }

  const user = await getUserByEmail(email);
  if (user && Number(user.askida ?? 0) !== 1) {
    if (await jetonSayisi(user.id, "sifirla", 3600) < 3) {
      const { ham, ozet } = jetonUret();
      await jetonOlustur(user.id, "sifirla", ozet, 3600);
      await epostaGonder({ kime: email, ...sifirlamaSablonu(`${siteUrl()}/sifirla/${ham}`) });
    }
  }
  return { ok: true };
}

/** Sıfırlama bağlantısındaki jetonla yeni parolayı belirler. */
export async function sifirlamaTamamlaAction(formData: FormData): Promise<AuthSonuc> {
  const ham = String(formData.get("jeton") ?? "");
  const parola = String(formData.get("parola") ?? "");
  if (parola.length < 8) {
    return { ok: false, hata: "Parola en az 8 karakter olmalı.", alan: "parola" };
  }

  const userId = await jetonTuket("sifirla", jetonOzeti(ham));
  if (!userId) {
    return { ok: false, hata: "Bağlantı geçersiz ya da süresi dolmuş. Yeniden isteyin." };
  }

  await parolaGuncelle(userId, hashPassword(parola));
  // Parolayı sıfırlayabilen kişi adrese erişebiliyor demektir
  await epostaDogrulandiIsaretle(userId);
  await setSessionCookie(userId);
  revalidatePath("/", "layout");
  // Veri önbelleği rota önbelleğinden ayrı; etiket olmadan 60 sn beklerdi.
  // updateTag: server action içinden çağrılınca değişiklik anında görünür.
  updateTag(ICERIK_ETIKETI);
  return { ok: true };
}

/** Giriş — e-posta ve parola ile. */
export async function girisAction(formData: FormData): Promise<AuthSonuc> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const parola = String(formData.get("parola") ?? "");

  const user = await getUserByEmail(email);
  if (!user || !verifyPassword(parola, user.pass_hash)) {
    return { ok: false, hata: "E-posta veya parola hatalı." };
  }
  if (Number(user.askida ?? 0) === 1) {
    return { ok: false, hata: "Bu hesap askıya alınmış. İtiraz için iletişime geçin." };
  }
  await setSessionCookie(user.id);
  revalidatePath("/", "layout");
  // Veri önbelleği rota önbelleğinden ayrı; etiket olmadan 60 sn beklerdi.
  // updateTag: server action içinden çağrılınca değişiklik anında görünür.
  updateTag(ICERIK_ETIKETI);
  return { ok: true };
}

// ---- Bülten -------------------------------------------------------------------

export async function bultenKayitAction(formData: FormData): Promise<AuthSonuc> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const kaynak = String(formData.get("kaynak") ?? "footer");
  // Bot tuzağı: gizli alan doluysa istek sessizce başarılı görünür
  if (String(formData.get("website") ?? "")) return { ok: true };

  if (!EPOSTA_KALIBI.test(email)) {
    return { ok: false, hata: "Geçerli bir e-posta adresi girin.", alan: "email" };
  }

  const { zatenOnayli, onayToken } = await bultenKaydet(email, kaynak);
  if (zatenOnayli) {
    return { ok: false, hata: "Bu adres zaten abone. Gelen kutunu kontrol et." };
  }

  const sonuc = await epostaGonder({
    kime: email,
    ...bultenOnaySablonu(`${siteUrl()}/api/bulten/onay?t=${onayToken}`),
  });
  if (sonuc.kapali) {
    return { ok: false, hata: "Bülten gönderimi henüz yapılandırılmadı." };
  }
  return sonuc.ok ? { ok: true } : { ok: false, hata: sonuc.hata ?? "Gönderilemedi." };
}

/**
 * Hazır liste kütüphanesini veritabanına yükler.
 * Var olan slug'lar atlanır; tekrar çalıştırmak güvenlidir.
 */
export async function icerikYukleAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const yayinla = String(formData.get("durum")) === "approved";
  const kategori = String(formData.get("kategori") ?? "hepsi");

  const { HAZIR_ICERIK } = await import("./icerik");
  const secilen =
    kategori === "hepsi"
      ? HAZIR_ICERIK
      : HAZIR_ICERIK.filter((k) => k.kategori === kategori);

  if (!secilen.length) {
    redirect("/admin/icerik?e=" + encodeURIComponent("Kategori bulunamadı."));
  }

  const s = await icerikYukle(secilen, yayinla ? "approved" : "pending");

  await denetimKaydi(
    yonetici.id,
    yonetici.username,
    "Hazır içerik yüklendi",
    `${s.eklenenListe} liste, ${s.eklenenMadde} madde (${yayinla ? "yayında" : "taslak"})`
  );

  revalidatePath("/admin/icerik");
  revalidatePath("/admin/moderasyon");
  revalidatePath("/");

  const uyari = s.bulunamayanKategori.length
    ? ` Kategori bulunamadı: ${s.bulunamayanKategori.join(", ")}.`
    : "";
  redirect(
    "/admin/icerik?ok=" +
      encodeURIComponent(
        `${s.eklenenListe} liste ve ${s.eklenenMadde} madde eklendi. ` +
          `${s.atlanan} liste zaten vardı, atlandı.${uyari}`
      )
  );
}

/** Sponsor kutularını yönetir (ekle / kaydet / sil). */
export async function reklamAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const islem = String(formData.get("islem") ?? "");

  const hata = (m: string) => redirect("/admin/reklam?e=" + encodeURIComponent(m));

  if (islem === "ekle") {
    const baslik = String(formData.get("baslik") ?? "").trim();
    const adres = gorselTemizle(String(formData.get("adres") ?? ""));
    if (baslik.length < 2) hata("Sponsor adı çok kısa.");
    if (!adres) hata("Hedef adres https ile başlamalı.");

    await reklamEkle({
      baslik,
      aciklama: String(formData.get("aciklama") ?? "").trim().slice(0, 140),
      gorsel: gorselTemizle(String(formData.get("gorsel") ?? "")),
      adres,
      konum: "liste-yan",
      sira: Number(formData.get("sira") ?? 0) || 0,
    });
    await denetimKaydi(yonetici.id, yonetici.username, "Sponsor eklendi", baslik);
  } else {
    const id = Number(formData.get("id"));
    if (islem === "sil") {
      await reklamSil(id);
      await denetimKaydi(yonetici.id, yonetici.username, "Sponsor silindi", `#${id}`);
    } else if (islem === "kaydet") {
      const adres = gorselTemizle(String(formData.get("adres") ?? ""));
      if (!adres) hata("Hedef adres https ile başlamalı.");
      await reklamGuncelle(id, {
        baslik: String(formData.get("baslik") ?? "").trim() || undefined,
        aciklama: String(formData.get("aciklama") ?? "").trim().slice(0, 140),
        gorsel: gorselTemizle(String(formData.get("gorsel") ?? "")),
        adres,
        aktif: formData.get("aktif") ? 1 : 0,
        sira: Number(formData.get("sira") ?? 0) || 0,
      });
      await denetimKaydi(yonetici.id, yonetici.username, "Sponsor güncellendi", `#${id}`);
    }
  }

  revalidatePath("/admin/reklam");
  revalidatePath("/liste", "layout");
  redirect("/admin/reklam?ok=" + encodeURIComponent("Kaydedildi."));
}

/** Künye tarayıcısını bir parti çalıştırır (kaldığı yerden devam eder). */
export async function kunyeTaraAction() {
  const yonetici = await requireAdmin();
  const { kunyeTara } = await import("./kunye-tarayici");
  const s = await kunyeTara(20);

  await denetimKaydi(
    yonetici.id, yonetici.username, "Künye tarandı",
    `${s.incelenen} madde, ${s.oneri} öneri`
  );
  revalidatePath("/admin/kunye");
  redirect(
    "/admin/kunye?ok=" +
      encodeURIComponent(
        `${s.incelenen} madde tarandı · ${s.oneri} yeni öneri · ` +
          `${s.bulunamayan} doğrulanamadı · ${s.adaysiz} marka değil (atlandı).`
      )
  );
}

/** Görsel tarayıcısını bir parti çalıştırır (sitesi olup görseli olmayanlar). */
export async function gorselTaraAction() {
  const yonetici = await requireAdmin();
  const { gorselTara } = await import("./kunye-tarayici");
  const s = await gorselTara(20);

  await denetimKaydi(
    yonetici.id, yonetici.username, "Görsel tarandı",
    `${s.incelenen} madde, ${s.oneri} öneri`
  );
  revalidatePath("/admin/kunye");
  redirect(
    "/admin/kunye?ok=" +
      encodeURIComponent(
        s.incelenen === 0
          ? "Taranacak madde kalmadı — sitesi olup görseli olmayan madde yok."
          : `${s.incelenen} madde tarandı · ${s.oneri} görsel önerisi · ${s.bulunamayan} sayfada og:image yok.`
      )
  );
}

/** Seçilen önerileri onaylar (maddeye yazar) ya da reddeder. */
export async function oneriKararAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const karar = String(formData.get("karar")) === "onayla" ? "onaylandi" : "reddedildi";

  // "Tümünü onayla" seçeneği: görünen sayfadaki değil, süzgece uyan hepsi
  let idler: number[];
  if (formData.get("kapsam") === "hepsi") {
    const enAz = Number(formData.get("enAzGuven") ?? 0) || 0;
    const { satirlar } = await onerileriGetir({ durum: "bekliyor", enAzGuven: enAz, limit: 200 });
    idler = satirlar.map((s) => s.id);
  } else {
    idler = formData.getAll("id").map((v) => Number(v)).filter(Number.isFinite);
  }

  if (!idler.length) {
    redirect("/admin/kunye?e=" + encodeURIComponent("Hiç öneri seçilmedi."));
  }

  const adet = await onerileriKararaBagla(idler, karar);
  await denetimKaydi(
    yonetici.id, yonetici.username,
    karar === "onaylandi" ? "Künye önerisi onaylandı" : "Künye önerisi reddedildi",
    `${idler.length} öneri`
  );

  revalidatePath("/admin/kunye");
  revalidatePath("/liste", "layout");
  redirect(
    "/admin/kunye?ok=" +
      encodeURIComponent(
        karar === "onaylandi"
          ? `${adet} öneri onaylandı ve maddelere yazıldı.`
          : `${idler.length} öneri reddedildi.`
      )
  );
}

/** Doğrulanmış resmî site adreslerini eşleşen maddelere yazar. */
export async function kunyeUygulaAction() {
  const yonetici = await requireAdmin();
  const { DOGRULANMIS_SITELER } = await import("./icerik/kunye");
  const s = await kunyeUygula(DOGRULANMIS_SITELER);

  await denetimKaydi(
    yonetici.id,
    yonetici.username,
    "Künye uygulandı",
    `${s.guncellenen} maddeye site adresi yazıldı`
  );
  revalidatePath("/admin/icerik");
  revalidatePath("/liste", "layout");
  redirect(
    "/admin/icerik?ok=" +
      encodeURIComponent(
        `${s.guncellenen} maddeye doğrulanmış site adresi yazıldı. ` +
          `${s.eslesmeyen} marka listelerde bulunamadı.`
      )
  );
}

/** Taslakta bekleyen listeleri toplu yayına alır. */
export async function taslaklariYayinlaAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const kategori = String(formData.get("kategori") ?? "hepsi");
  const adet = await taslaklariYayinla(kategori === "hepsi" ? undefined : kategori);

  await denetimKaydi(yonetici.id, yonetici.username, "Taslaklar yayına alındı", `${adet} liste`);
  revalidatePath("/admin/icerik");
  revalidatePath("/admin/moderasyon");
  revalidatePath("/", "layout");
  // Veri önbelleği rota önbelleğinden ayrı; etiket olmadan 60 sn beklerdi.
  // updateTag: server action içinden çağrılınca değişiklik anında görünür.
  updateTag(ICERIK_ETIKETI);
  redirect("/admin/icerik?ok=" + encodeURIComponent(`${adet} liste yayına alındı.`));
}

/** Gündem taramasını elle tetikler (zamanlanmış işi beklemeden). */
export async function gundemTaramaAction() {
  const yonetici = await requireAdmin();
  const { gundemTaramasi } = await import("./gundem");
  const s = await gundemTaramasi(true);

  if (s.hata) {
    redirect("/admin/moderasyon?e=" + encodeURIComponent(s.hata));
  }

  await denetimKaydi(
    yonetici.id,
    yonetici.username,
    "Gündem tarandı",
    `${s.maddeEklendi} aday madde, ${s.taslakAcildi} taslak`
  );
  revalidatePath("/admin/moderasyon");
  redirect(
    "/admin/moderasyon?ok=" +
      encodeURIComponent(
        `${s.incelenen} başlık incelendi · ${s.maddeEklendi} aday madde eklendi · ` +
          `${s.taslakAcildi} liste taslağı açıldı · ${s.atlanan} atlandı.`
      )
  );
}

/** Yönetim panelinden haftalık bülteni tüm onaylı abonelere gönderir. */
export async function bultenGonderAction() {
  const yonetici = await requireAdmin();
  const { haftalikBulteniGonder } = await import("./bulten-gonderim");
  const sonuc = await haftalikBulteniGonder();

  if (!sonuc.ok) {
    redirect("/admin/bulten?e=" + encodeURIComponent(sonuc.hata ?? "Gönderilemedi."));
  }

  await denetimKaydi(
    yonetici.id,
    yonetici.username,
    "Bülten gönderildi",
    `${sonuc.gonderilen} abone`
  );
  const not =
    `${sonuc.gonderilen} aboneye gönderildi.` +
    (sonuc.basarisiz > 0 ? ` ${sonuc.basarisiz} adres başarısız.` : "");
  redirect("/admin/bulten?ok=" + encodeURIComponent(not));
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/");
}

// ---- Öneriler -------------------------------------------------------------------

export async function suggestTopicAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/giris?e=" + encodeURIComponent("Başlık önermek için üye girişi gerekli."));
  // Öneriler kapalıyken form zaten görünmez; doğrudan POST edilmesine karşı.
  // Yönetici kapalıyken de ekleyebilir: başlık yayınlama yolu budur.
  if (user!.role !== "admin" && !(await ozellikAcik("oneri_acik"))) {
    redirect("/oner?e=" + encodeURIComponent("Başlık önerileri şu anda kapalı."));
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const categoryId = Number(formData.get("categoryId") ?? 0);
  const city = String(formData.get("city") ?? "").trim() || null;
  const itemsRaw = String(formData.get("items") ?? "");

  if (title.length < 8) {
    redirect("/oner?e=" + encodeURIComponent("Başlık en az 8 karakter olmalı."));
  }
  if (!(await getCategories()).some((c) => c.id === categoryId)) {
    redirect("/oner?e=" + encodeURIComponent("Geçerli bir kategori seçin."));
  }
  const itemNames = itemsRaw
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .slice(0, 10);
  if (itemNames.length < 3) {
    redirect("/oner?e=" + encodeURIComponent("En az 3 madde yazın (her satıra bir madde)."));
  }

  // Yönetici başlıkları onay beklemeden yayına girer
  const isAdmin = user!.role === "admin";
  const { slug } = await createTopicSuggestion({
    title, description, categoryId, city, userId: user!.id, itemNames,
    status: isAdmin ? "approved" : "pending",
  });
  redirect(isAdmin ? `/liste/${slug}` : "/oner?ok=1");
}

export async function suggestItemAction(formData: FormData) {
  const user = await getSessionUser();
  const slug = String(formData.get("slug") ?? "");
  if (!user) redirect(`/giris?e=` + encodeURIComponent("Madde önermek için üye girişi gerekli."));
  if (user!.role !== "admin" && !(await ozellikAcik("oneri_acik"))) {
    redirect(`/liste/${slug}?hata=` + encodeURIComponent("Madde önerileri şu anda kapalı."));
  }

  const topic = await getTopicBySlug(slug);
  const name = String(formData.get("name") ?? "").trim();
  if (topic && name.length >= 2) {
    await createItemSuggestion(topic.id, name, user!.id);
  }
  redirect(`/liste/${slug}?onerildi=1`);
}

// ---- Yorumlar -------------------------------------------------------------------

export async function addCommentAction(formData: FormData) {
  const user = await getSessionUser();
  const slug = String(formData.get("slug") ?? "");
  if (!user) {
    redirect("/giris?e=" + encodeURIComponent("Yorum yazmak için üye girişi gerekli."));
  }
  if (!(await ozellikAcik("yorum_acik"))) {
    redirect(`/liste/${slug}?hata=` + encodeURIComponent("Yorumlar şu anda kapalı."));
  }

  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 2) {
    redirect(`/liste/${slug}?yorumHata=` + encodeURIComponent("Yorum çok kısa."));
  }
  if (body.length > YORUM_MAX) {
    redirect(`/liste/${slug}?yorumHata=` + encodeURIComponent(`Yorum en fazla ${YORUM_MAX} karakter olabilir.`));
  }

  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") {
    redirect(`/liste/${slug}`);
  }

  await addComment(topic!.id, user!.id, body);

  // Liste sahibine haber ver (kendi listesine yorum yazdıysa gerek yok)
  const sahip = await getTopicOwner(topic!.id);
  if (sahip && sahip !== user!.id) {
    await addNotification(
      sahip,
      `${user!.username} listene yorum yaptı: ${topic!.title}`,
      `/liste/${slug}#yorumlar`
    );
  }

  revalidatePath(`/liste/${slug}`);
  redirect(`/liste/${slug}#yorumlar`);
}

/** Yorumu gizler — yalnızca yorum sahibi ya da yönetici. */
export async function hideCommentAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/giris");

  const id = Number(formData.get("id"));
  const slug = String(formData.get("slug") ?? "");
  const yorum = await getCommentById(id);

  if (yorum && (user!.role === "admin" || Number(yorum.user_id) === user!.id)) {
    await hideComment(id);
  }
  revalidatePath(`/liste/${slug}`);
  revalidatePath("/admin");
  redirect(`/liste/${slug}#yorumlar`);
}

// ---- Yönetim: kategoriler ----------------------------------------------------------

export async function kategoriEkleAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const ad = String(formData.get("ad") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim().slice(0, 4);
  if (ad.length < 2) redirect("/admin/kategoriler?e=" + encodeURIComponent("Kategori adı çok kısa."));

  const slug = await createCategory(ad, emoji || "📁");
  await denetimKaydi(yonetici.id, yonetici.username, "Kategori eklendi", ad, slug);
  revalidatePath("/admin/kategoriler");
  revalidatePath("/");
  redirect("/admin/kategoriler?ok=" + encodeURIComponent(`"${ad}" eklendi.`));
}

export async function kategoriGuncelleAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const id = Number(formData.get("id"));
  const islem = String(formData.get("islem") ?? "kaydet");

  if (islem === "sil") {
    const sonuc = await deleteCategory(id);
    await denetimKaydi(yonetici.id, yonetici.username, "Kategori silindi", `#${id}`, sonuc.ok ? "" : sonuc.sebep ?? "");
    revalidatePath("/admin/kategoriler");
    revalidatePath("/");
    redirect(
      sonuc.ok
        ? "/admin/kategoriler?ok=" + encodeURIComponent("Kategori silindi.")
        : "/admin/kategoriler?e=" + encodeURIComponent(sonuc.sebep ?? "Silinemedi.")
    );
  }

  if (islem === "yukari" || islem === "asagi") {
    const hepsi = await getCategoriesAdmin();
    const i = hepsi.findIndex((c) => c.id === id);
    const j = islem === "yukari" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < hepsi.length) {
      await updateCategory(hepsi[i].id, { sort: hepsi[j].sort });
      await updateCategory(hepsi[j].id, { sort: hepsi[i].sort });
      await denetimKaydi(yonetici.id, yonetici.username, "Kategori sırası değişti", hepsi[i].name);
    }
    revalidatePath("/admin/kategoriler");
    revalidatePath("/");
    redirect("/admin/kategoriler");
  }

  const ad = String(formData.get("ad") ?? "").trim();
  const emoji = String(formData.get("emoji") ?? "").trim().slice(0, 4);
  const aktif = formData.get("aktif") ? 1 : 0;
  await updateCategory(id, { name: ad || undefined, emoji: emoji || undefined, aktif });
  await denetimKaydi(yonetici.id, yonetici.username, "Kategori güncellendi", ad || `#${id}`);
  revalidatePath("/admin/kategoriler");
  revalidatePath("/");
  redirect("/admin/kategoriler?ok=" + encodeURIComponent("Kaydedildi."));
}

// ---- Yönetim: listeler ve maddeler --------------------------------------------------

export async function listeGuncelleAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const id = Number(formData.get("id"));
  const islem = String(formData.get("islem") ?? "kaydet");

  if (islem === "sil") {
    const t = await getTopicById(id);
    await deleteTopic(id);
    await denetimKaydi(yonetici.id, yonetici.username, "Liste silindi", t?.title ?? `#${id}`);
    revalidatePath("/admin/listeler");
    revalidatePath("/");
    redirect("/admin/listeler?ok=" + encodeURIComponent("Liste ve tüm kayıtları silindi."));
  }

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const category_id = Number(formData.get("category_id"));
  const city = String(formData.get("city") ?? "").trim() || null;
  const status = String(formData.get("status") ?? "approved");

  await updateTopic(id, {
    title: title || undefined,
    description,
    category_id: Number.isFinite(category_id) ? category_id : undefined,
    city,
    status,
    one_cikan: formData.get("one_cikan") ? 1 : 0,
    menude: formData.get("menude") ? 1 : 0,
    hero_sira: Number(formData.get("hero_sira") ?? 0) || 0,
  });
  await denetimKaydi(yonetici.id, yonetici.username, "Liste güncellendi", title || `#${id}`);
  revalidatePath(`/admin/listeler/${id}`);
  revalidatePath("/");
  redirect(`/admin/listeler/${id}?ok=` + encodeURIComponent("Kaydedildi."));
}

export async function maddeYonetAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const topicId = Number(formData.get("topicId"));
  const islem = String(formData.get("islem"));

  if (islem === "ekle") {
    const ad = String(formData.get("ad") ?? "").trim();
    if (ad.length >= 2) {
      await addItemAdmin(topicId, ad);
      await denetimKaydi(yonetici.id, yonetici.username, "Madde eklendi", ad);
    }
  } else {
    const id = Number(formData.get("id"));
    if (islem === "sil") {
      await deleteItem(id);
      await denetimKaydi(yonetici.id, yonetici.username, "Madde silindi", `#${id}`);
    } else if (islem === "kaydet") {
      const ad = String(formData.get("ad") ?? "").trim();
      const durum = String(formData.get("durum") ?? "active");
      const sabit = formData.get("sabit") ? 1 : 0;
      const elleSira = Number(formData.get("elle_sira") ?? 0) || 0;
      await updateItem(id, {
        name: ad || undefined,
        status: durum,
        sabit,
        elle_sira: elleSira,
        gorsel: gorselTemizle(String(formData.get("gorsel") ?? "")),
        site: gorselTemizle(String(formData.get("site") ?? "")),
        // Künye alanları: adres ve telefon serbest metin, harita yine https
        adres: String(formData.get("adres") ?? "").trim().slice(0, 200),
        telefon: String(formData.get("telefon") ?? "").trim().slice(0, 40),
        harita: gorselTemizle(String(formData.get("harita") ?? "")),
        fiyat: String(formData.get("fiyat") ?? "").trim().slice(0, 40),
      });
      await denetimKaydi(yonetici.id, yonetici.username, "Madde güncellendi", ad || `#${id}`);
    } else if (islem === "gorsel-cek") {
      // Maddenin web sitesinden og:image çeker. Adresi yönetici girdiği için
      // dış isteğe yalnızca burada izin veriliyor.
      const site = gorselTemizle(String(formData.get("site") ?? ""));
      if (site) {
        const bulunan = await ogGorselCek(site);
        if (bulunan) {
          await updateItem(id, { gorsel: bulunan, site });
          await denetimKaydi(yonetici.id, yonetici.username, "Görsel çekildi", bulunan.slice(0, 80));
        } else {
          const t0 = await getTopicById(topicId);
          if (t0) revalidatePath(`/liste/${t0.slug}`);
          redirect(
            `/admin/listeler/${topicId}?e=` +
              encodeURIComponent("Bu adreste og:image bulunamadı. Görsel adresini elle girin.")
          );
        }
      }
    }
  }

  const t = await getTopicById(topicId);
  revalidatePath(`/admin/listeler/${topicId}`);
  if (t) revalidatePath(`/liste/${t.slug}`);
  redirect(`/admin/listeler/${topicId}`);
}

// ---- Yönetim: hero ve mega menü -----------------------------------------------------

export async function vitrinAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const id = Number(formData.get("id"));
  const islem = String(formData.get("islem"));
  // Hangi ekrandan gelindiyse oraya dönülür (hero ve menü ayrı sayfalar)
  const donus = String(formData.get("donus") ?? "/admin/hero");
  // donus süzgeç/sayfa parametrelerini de taşıyabildiği için ok mesajı
  // eklerken ayracı adresteki duruma göre seçiyoruz.
  const donusMesaj = (ok: string) =>
    `${donus}${donus.includes("?") ? "&" : "?"}ok=${encodeURIComponent(ok)}`;
  // revalidatePath sorgu dizesi değil yol bekliyor
  const donusYol = donus.split("?")[0];
  const listeler = await getTopicsAdmin();

  // Kategori bazlı toplu menü işlemleri madde seçmeden çalışır
  if (islem === "menu-kategori-ac" || islem === "menu-kategori-kapat") {
    const slug = String(formData.get("kategori") ?? "");
    const acilsin = islem === "menu-kategori-ac";
    const hedefler = listeler.filter(
      (t) => t.categorySlug === slug && t.status === "approved" && t.menude !== (acilsin ? 1 : 0)
    );
    for (const t of hedefler) await updateTopic(t.id, { menude: acilsin ? 1 : 0 });
    await denetimKaydi(
      yonetici.id, yonetici.username,
      acilsin ? "Kategori menüye açıldı" : "Kategori menüden gizlendi",
      `${slug} · ${hedefler.length} liste`
    );
    revalidatePath(donusYol);
    revalidatePath("/", "layout");
  // Veri önbelleği rota önbelleğinden ayrı; etiket olmadan 60 sn beklerdi.
  // updateTag: server action içinden çağrılınca değişiklik anında görünür.
  updateTag(ICERIK_ETIKETI);
    redirect(donusMesaj(`${hedefler.length} liste güncellendi.`));
  }

  const liste = listeler.find((t) => t.id === id);
  if (!liste) redirect(donus);

  const oneCikanlar = listeler
    .filter((t) => t.one_cikan === 1 && t.status === "approved")
    .sort((a, b) => a.hero_sira - b.hero_sira);

  if (islem === "hero-ac") {
    const enBuyuk = oneCikanlar.reduce((m, t) => Math.max(m, t.hero_sira), 0);
    // heroda: gizlenmiş bir liste öne çıkarılırsa sessizce kaybolmasın
    await updateTopic(id, { one_cikan: 1, hero_sira: enBuyuk + 1, heroda: 1 });
    await denetimKaydi(yonetici.id, yonetici.username, "Hero'ya eklendi", liste!.title);
  } else if (islem === "hero-kapat") {
    await updateTopic(id, { one_cikan: 0, hero_sira: 0 });
    await denetimKaydi(yonetici.id, yonetici.username, "Hero'dan çıkarıldı", liste!.title);
  } else if (islem === "yukari" || islem === "asagi") {
    const i = oneCikanlar.findIndex((t) => t.id === id);
    const j = islem === "yukari" ? i - 1 : i + 1;
    if (i >= 0 && j >= 0 && j < oneCikanlar.length) {
      await updateTopic(oneCikanlar[i].id, { hero_sira: oneCikanlar[j].hero_sira });
      await updateTopic(oneCikanlar[j].id, { hero_sira: oneCikanlar[i].hero_sira });
      await denetimKaydi(yonetici.id, yonetici.username, "Hero sırası değişti", liste!.title);
    }
  } else if (islem === "sira-ver") {
    // Doğrudan konum: 1 en üst. Aradaki listeler kaydırılır.
    const hedef = Math.max(1, Math.min(oneCikanlar.length, Number(formData.get("sira") ?? 1)));
    const kalan = oneCikanlar.filter((t) => t.id !== id);
    kalan.splice(hedef - 1, 0, liste!);
    for (let i = 0; i < kalan.length; i++) {
      await updateTopic(kalan[i].id, { hero_sira: i + 1 });
    }
    await denetimKaydi(yonetici.id, yonetici.username, "Hero sırası verildi", `${liste!.title} → ${hedef}`);
  } else if (islem === "hero-gizle" || islem === "hero-goster") {
    // Otomatik gelen başlıkları da yönetebilmek için: gizlenen liste hero
    // bulucusunda hiç görünmez, yerini sıradaki popüler liste alır.
    // Gizlerken öne çıkan işareti de düşer — ikisi bir arada anlamsız olurdu.
    const gizle = islem === "hero-gizle";
    await updateTopic(id, gizle ? { heroda: 0, one_cikan: 0, hero_sira: 0 } : { heroda: 1 });
    await denetimKaydi(
      yonetici.id,
      yonetici.username,
      gizle ? "Hero'dan gizlendi" : "Hero'da yeniden gösterildi",
      liste!.title
    );
  } else if (islem === "menu-ac" || islem === "menu-kapat") {
    await updateTopic(id, { menude: islem === "menu-ac" ? 1 : 0 });
    await denetimKaydi(
      yonetici.id,
      yonetici.username,
      islem === "menu-ac" ? "Menüye eklendi" : "Menüden çıkarıldı",
      liste!.title
    );
  }

  revalidatePath(donusYol);
  revalidatePath("/", "layout");
  // Veri önbelleği rota önbelleğinden ayrı; etiket olmadan 60 sn beklerdi.
  // updateTag: server action içinden çağrılınca değişiklik anında görünür.
  updateTag(ICERIK_ETIKETI);
  redirect(donus);
}

// ---- Yönetim: blog -------------------------------------------------------------------

export async function blogEkleAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const baslik = String(formData.get("baslik") ?? "").trim();
  if (baslik.length < 3) {
    redirect("/admin/blog?e=" + encodeURIComponent("Başlık en az 3 karakter olmalı."));
  }
  const id = await createBlogYazi(baslik, yonetici.id);
  await denetimKaydi(yonetici.id, yonetici.username, "Blog yazısı oluşturuldu", baslik);
  revalidatePath("/admin/blog");
  redirect(`/admin/blog/${id}`);
}

export async function blogGuncelleAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const id = Number(formData.get("id"));
  const islem = String(formData.get("islem") ?? "kaydet");

  if (islem === "sil") {
    const y = await getBlogYaziById(id);
    await deleteBlogYazi(id);
    await denetimKaydi(yonetici.id, yonetici.username, "Blog yazısı silindi", y?.baslik ?? `#${id}`);
    revalidatePath("/admin/blog");
    revalidatePath("/blog");
    redirect("/admin/blog?ok=" + encodeURIComponent("Yazı silindi."));
  }

  const baslik = String(formData.get("baslik") ?? "").trim();
  const durum = String(formData.get("durum") ?? "taslak");
  await updateBlogYazi(id, {
    baslik: baslik || undefined,
    ozet: String(formData.get("ozet") ?? "").trim(),
    icerik: String(formData.get("icerik") ?? ""),
    kapak: String(formData.get("kapak") ?? "").trim(),
    durum,
  });
  await denetimKaydi(
    yonetici.id,
    yonetici.username,
    durum === "yayinda" ? "Blog yazısı yayınlandı" : "Blog yazısı kaydedildi",
    baslik || `#${id}`
  );
  revalidatePath("/admin/blog");
  revalidatePath("/blog");
  const y = await getBlogYaziById(id);
  if (y) revalidatePath(`/blog/${y.slug}`);
  redirect(`/admin/blog/${id}?ok=` + encodeURIComponent("Kaydedildi."));
}

// ---- Yönetim: üyeler ------------------------------------------------------------------

export async function uyeYonetAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const id = Number(formData.get("id"));
  const islem = String(formData.get("islem"));
  const hedef = (await getUserById(id));
  if (!hedef) redirect("/admin/uyeler");

  // Kendini kilitlemeyi ve son yöneticiyi düşürmeyi engelle
  if (id === yonetici.id && (islem === "askiya-al" || islem === "yetki-al")) {
    redirect("/admin/uyeler?e=" + encodeURIComponent("Kendi hesabında bu işlemi yapamazsın."));
  }
  if (islem === "yetki-al" && (await adminSayisi()) <= 1) {
    redirect("/admin/uyeler?e=" + encodeURIComponent("Son yöneticinin yetkisi alınamaz."));
  }

  if (islem === "yetki-ver") await updateUser(id, { role: "admin" });
  if (islem === "yetki-al") await updateUser(id, { role: "user" });
  if (islem === "askiya-al") await updateUser(id, { askida: 1 });
  if (islem === "askidan-cikar") await updateUser(id, { askida: 0 });

  const etiket: Record<string, string> = {
    "yetki-ver": "Yönetici yapıldı",
    "yetki-al": "Yöneticilik kaldırıldı",
    "askiya-al": "Üye askıya alındı",
    "askidan-cikar": "Üye askıdan çıkarıldı",
  };
  await denetimKaydi(yonetici.id, yonetici.username, etiket[islem] ?? islem, hedef!.username);
  revalidatePath("/admin/uyeler");
  redirect("/admin/uyeler?ok=" + encodeURIComponent("Güncellendi."));
}

export async function duyuruAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const mesaj = String(formData.get("mesaj") ?? "").trim();
  const link = String(formData.get("link") ?? "/").trim() || "/";
  if (mesaj.length < 5) {
    redirect("/admin/ayarlar?e=" + encodeURIComponent("Duyuru metni çok kısa."));
  }
  const adet = await duyuruGonder(mesaj, link);
  await denetimKaydi(yonetici.id, yonetici.username, "Duyuru gönderildi", `${adet} üye`, mesaj);
  revalidatePath("/admin/ayarlar");
  redirect("/admin/ayarlar?ok=" + encodeURIComponent(`${adet} üyeye duyuru gönderildi.`));
}

export async function ayarKaydetAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const anahtarlar = ["site_adi", "site_aciklama", "duello_acik", "yorum_acik", "oneri_acik"];
  for (const a of anahtarlar) {
    const deger = formData.get(a);
    await setSetting(a, deger === null ? "0" : String(deger));
  }
  await denetimKaydi(yonetici.id, yonetici.username, "Ayarlar güncellendi", "site");
  revalidatePath("/admin/ayarlar");
  redirect("/admin/ayarlar?ok=" + encodeURIComponent("Ayarlar kaydedildi."));
}

/** Hero'ya kategori başına kaç listenin otomatik ekleneceği. */
export async function heroLimitAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const donus = String(formData.get("donus") ?? "/admin/hero");
  const ham = Number(formData.get("limit"));
  const limit = Number.isFinite(ham)
    ? Math.max(0, Math.min(HERO_KATEGORI_EN_COK, Math.trunc(ham)))
    : HERO_KATEGORI_VARSAYILAN;
  await setSetting("hero_kategori_limit", String(limit));
  await denetimKaydi(
    yonetici.id, yonetici.username,
    "Hero kategori limiti", `kategori başına ${limit} liste`
  );
  revalidatePath("/admin/hero");
  revalidatePath("/", "layout");
  // Veri önbelleği rota önbelleğinden ayrı; etiket olmadan 60 sn beklerdi.
  // updateTag: server action içinden çağrılınca değişiklik anında görünür.
  updateTag(ICERIK_ETIKETI);
  redirect(
    `${donus}${donus.includes("?") ? "&" : "?"}ok=` +
      encodeURIComponent(
        limit === 0
          ? "Otomatik doldurma kapatıldı; hero yalnızca öne çıkardıklarını gösterecek."
          : `Kategori başına ${limit} liste otomatik eklenecek.`
      )
  );
}

// ---- İkili karşılaştırma ----------------------------------------------------------

/** Düello sonucunu kaydeder. Misafirler de oynayabilir; günlük sınır vardır. */
export async function duelloAction(
  slug: string,
  kazananId: number,
  kaybedenId: number
): Promise<{ ok: boolean; mesaj?: string; kalan?: number }> {
  if (!(await ozellikAcik("duello_acik"))) return { ok: false, mesaj: "Düello şu anda kapalı." };
  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") return { ok: false, mesaj: "Liste bulunamadı." };
  if (kazananId === kaybedenId) return { ok: false, mesaj: "Geçersiz eşleşme." };

  // Her iki madde de bu listeye ait ve aktif olmalı
  const { top } = await getTopicBoard(topic.id);
  const gecerli = new Set(top.map((i) => i.id));
  if (!gecerli.has(kazananId) || !gecerli.has(kaybedenId)) {
    return { ok: false, mesaj: "Geçersiz eşleşme." };
  }

  const { voterKey, userId } = await getVoterIdentity();
  const yapilan = await getDuelloSayisi(topic.id, voterKey);
  if (yapilan >= GUNLUK_DUELLO_SINIRI) {
    return { ok: false, mesaj: "Bugünlük düello hakkın doldu, yarın devam!", kalan: 0 };
  }

  await recordDuel({ topicId: topic.id, kazananId, kaybedenId, voterKey, userId });
  revalidatePath(`/liste/${slug}`);
  return { ok: true, kalan: GUNLUK_DUELLO_SINIRI - yapilan - 1 };
}

// ---- Yönetim: gündemden otomatik liste taslağı ---------------------------------------

/**
 * Google Trends adayından tek tıkla 10 maddelik taslak liste üretir.
 * Maddeler yer tutucudur; yönetici düzenleme sayfasında gerçek adlarla
 * değiştirir. Amaç sıfırdan liste kurma yükünü azaltmak.
 */
export async function gundemdenTaslakAction(formData: FormData) {
  const yonetici = await requireAdmin();
  const konu = String(formData.get("konu") ?? "").trim();
  const kategoriId = Number(formData.get("kategoriId"));
  if (konu.length < 2) redirect("/admin/moderasyon");

  const kategoriler = await getCategories();
  const kategori = kategoriler.find((c) => c.id === kategoriId) ?? kategoriler[0];
  if (!kategori) redirect("/admin/moderasyon");

  const baslik = `${konu} — Gündem Sıralaması`;
  const maddeler = Array.from({ length: 10 }, (_, i) => `${konu} — aday ${i + 1}`);

  const { id, slug } = await createTopicSuggestion({
    title: baslik,
    description: `Gündem taramasından üretildi: "${konu}". Maddeleri düzenleyip yayına alın.`,
    categoryId: kategori.id,
    city: null,
    userId: yonetici.id,
    itemNames: maddeler,
    status: "pending", // taslak: düzenlenmeden yayına çıkmasın
  });

  await denetimKaydi(yonetici.id, yonetici.username, "Gündemden taslak üretildi", baslik, konu);
  revalidatePath("/admin/listeler");
  redirect(`/admin/listeler/${id}?ok=` + encodeURIComponent(`Taslak hazır (/liste/${slug}). Maddeleri düzenleyip durumu "Yayında" yapın.`));
}

// ---- Takip --------------------------------------------------------------------------

export async function takipAction(formData: FormData) {
  const user = await getSessionUser();
  const slug = String(formData.get("slug") ?? "");
  if (!user) {
    redirect("/giris?e=" + encodeURIComponent("Liste takip etmek için üye girişi gerekli."));
  }
  const topic = await getTopicBySlug(slug);
  if (topic) await takipDegistir(user!.id, topic.id);
  revalidatePath(`/liste/${slug}`);
  redirect(`/liste/${slug}`);
}

// ---- Tahmin oyunu ---------------------------------------------------------------------

export async function tahminAction(formData: FormData) {
  const user = await getSessionUser();
  const slug = String(formData.get("slug") ?? "");
  if (!user) {
    redirect("/giris?e=" + encodeURIComponent("Tahmin yapmak için üye girişi gerekli."));
  }

  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") redirect(`/liste/${slug}`);

  const itemId = Number(formData.get("itemId"));
  const { top } = await getTopicBoard(topic!.id);
  if (!top.some((i) => i.id === itemId)) redirect(`/liste/${slug}#tahmin`);

  await tahminKaydet(user!.id, topic!.id, itemId);
  revalidatePath(`/liste/${slug}`);
  redirect(`/liste/${slug}#tahmin`);
}

// ---- Kişisel sıralama -------------------------------------------------------------

/** Üyenin kendi sıralamasını kaydeder. Sıralama normal oydan ağır sayılır. */
export async function saveRerankAction(slug: string, itemIds: number[]) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/giris?e=" + encodeURIComponent("Kendi sıralamanı kaydetmek için üye girişi gerekli."));
  }

  const topic = await getTopicBySlug(slug);
  if (!topic || topic.status !== "approved") return;

  // Yalnızca bu başlığa ait aktif maddeler kabul edilir
  const { top } = await getTopicBoard(topic.id);
  const gecerli = new Set(top.map((i) => i.id));
  const temiz = itemIds.map(Number).filter((id) => gecerli.has(id));
  // Tekrarları at, eksikleri sona ekle
  const benzersiz = [...new Set(temiz)];
  for (const i of top) if (!benzersiz.includes(i.id)) benzersiz.push(i.id);

  await saveRerank(user!.id, topic.id, benzersiz);
  revalidatePath(`/liste/${slug}`);
}

// ---- Admin ----------------------------------------------------------------------

async function requireAdmin() {
  const user = await getSessionUser();
  if (!user || user.role !== "admin") redirect("/giris?e=" + encodeURIComponent("Yönetici girişi gerekli."));
  return user!;
}

export async function adminTopicAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const op = String(formData.get("op"));
  const sahip = await getTopicOwner(id);

  if (op === "approve") {
    await setTopicStatus(id, "approved");
    const t = await getTopicById(id);
    if (sahip && t) {
      await addNotification(sahip, `Liste önerin yayına alındı: ${t.title}`, `/liste/${t.slug}`);
    }
  }
  if (op === "reject") {
    const t = await getTopicById(id);
    await setTopicStatus(id, "rejected");
    if (sahip && t) {
      await addNotification(sahip, `Liste önerin yayınlanmadı: ${t.title}`, "/oner");
    }
  }
  revalidatePath("/admin");
  revalidatePath("/");
}

export async function adminItemAction(formData: FormData) {
  await requireAdmin();
  const id = Number(formData.get("id"));
  const op = String(formData.get("op"));
  const bilgi = await getItemOwnerAndTopic(id);

  if (op === "candidate") await setItemStatus(id, "candidate"); // onayla → aday listesine
  if (op === "active") await setItemStatus(id, "active");       // doğrudan Top 10 havuzuna
  if (op === "reject") await setItemStatus(id, "rejected");

  if (bilgi?.userId) {
    const mesaj =
      op === "reject"
        ? `Madde önerin kabul edilmedi: ${bilgi.itemName}`
        : `Madde önerin listeye eklendi: ${bilgi.itemName}`;
    await addNotification(bilgi.userId, mesaj, `/liste/${bilgi.topicSlug}`);
  }
  revalidatePath("/admin");
}

/** Bildirimleri okundu işaretler (bildirimler sayfası açılınca). */
export async function markNotificationsReadAction() {
  const user = await getSessionUser();
  if (!user) return;
  await markAllRead(user.id);
  revalidatePath("/bildirimler");
}
