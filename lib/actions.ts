"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  addComment, addNotification, createItemSuggestion, createTopicSuggestion, createUser,
  getCategories, getCommentById, getItemOwnerAndTopic, getTopicById, getTopicBySlug, getTopicOwner,
  getUserByUsername, hideComment, markAllRead, setItemStatus, setTopicStatus, YORUM_MAX,
} from "./db";
import {
  clearSessionCookie, getSessionUser, hashPassword, setSessionCookie, verifyPassword,
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
