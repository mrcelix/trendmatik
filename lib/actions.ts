"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addComment, addNotification, createItemSuggestion, createTopicSuggestion, createUser,
  getCategories, getCommentById, getItemOwnerAndTopic, getTopicBoard, getTopicById,
  getTopicBySlug, getTopicOwner,
  addItemAdmin, createBlogYazi, createCategory, deleteBlogYazi, deleteCategory, deleteItem,
  deleteTopic, denetimKaydi, getBlogYaziById, updateBlogYazi,
  getCategoriesAdmin, getDuelloSayisi, getTopicsAdmin, getUserByUsername,
  GUNLUK_DUELLO_SINIRI, hideComment,
  markAllRead, recordDuel, saveRerank, setItemStatus, setTopicStatus, updateCategory,
  updateItem, updateTopic, YORUM_MAX,
  adminSayisi, duyuruGonder, getUserById, setSetting, tahminKaydet, updateUser,
} from "./db";
import {
  clearSessionCookie, getSessionUser, getVoterIdentity, hashPassword, setSessionCookie,
  verifyPassword,
} from "./auth";

// ---- Üyelik -------------------------------------------------------------------

export async function registerAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  if (!/^[a-zA-Z0-9_çğıöşüÇĞİÖŞÜ]{3,24}$/.test(username)) {
    redirect("/kayit?e=" + encodeURIComponent("Kullanıcı adı 3-24 karakter olmalı (harf, rakam, _)."));
  }
  if (password.length < 6) {
    redirect("/kayit?e=" + encodeURIComponent("Parola en az 6 karakter olmalı."));
  }
  if (await getUserByUsername(username)) {
    redirect("/kayit?e=" + encodeURIComponent("Bu kullanıcı adı zaten alınmış."));
  }
  const id = await createUser(username, hashPassword(password));
  await setSessionCookie(id);
  redirect("/");
}

export async function loginAction(formData: FormData) {
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const user = await getUserByUsername(username);
  if (!user || !verifyPassword(password, user.pass_hash)) {
    redirect("/giris?e=" + encodeURIComponent("Kullanıcı adı veya parola hatalı."));
  }
  if (Number(user.askida ?? 0) === 1) {
    redirect("/giris?e=" + encodeURIComponent("Bu hesap askıya alınmış. İtiraz için iletişime geçin."));
  }
  await setSessionCookie(user.id);
  redirect(user.role === "admin" ? "/admin" : "/");
}

export async function logoutAction() {
  await clearSessionCookie();
  redirect("/");
}

// ---- Öneriler -------------------------------------------------------------------

export async function suggestTopicAction(formData: FormData) {
  const user = await getSessionUser();
  if (!user) redirect("/giris?e=" + encodeURIComponent("Başlık önermek için üye girişi gerekli."));

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
      });
      await denetimKaydi(yonetici.id, yonetici.username, "Madde güncellendi", ad || `#${id}`);
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
  const listeler = await getTopicsAdmin();
  const liste = listeler.find((t) => t.id === id);
  if (!liste) redirect("/admin/vitrin");

  const oneCikanlar = listeler
    .filter((t) => t.one_cikan === 1 && t.status === "approved")
    .sort((a, b) => a.hero_sira - b.hero_sira);

  if (islem === "hero-ac") {
    const enBuyuk = oneCikanlar.reduce((m, t) => Math.max(m, t.hero_sira), 0);
    await updateTopic(id, { one_cikan: 1, hero_sira: enBuyuk + 1 });
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
  } else if (islem === "menu-ac" || islem === "menu-kapat") {
    await updateTopic(id, { menude: islem === "menu-ac" ? 1 : 0 });
    await denetimKaydi(
      yonetici.id,
      yonetici.username,
      islem === "menu-ac" ? "Menüye eklendi" : "Menüden çıkarıldı",
      liste!.title
    );
  }

  revalidatePath("/admin/vitrin");
  revalidatePath("/", "layout");
  redirect("/admin/vitrin");
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

// ---- İkili karşılaştırma ----------------------------------------------------------

/** Düello sonucunu kaydeder. Misafirler de oynayabilir; günlük sınır vardır. */
export async function duelloAction(
  slug: string,
  kazananId: number,
  kaybedenId: number
): Promise<{ ok: boolean; mesaj?: string; kalan?: number }> {
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
