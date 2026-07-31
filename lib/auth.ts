import { cookies } from "next/headers";
import {
  createHmac, randomBytes, scryptSync, timingSafeEqual, randomUUID,
} from "node:crypto";
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { getUserById, type User } from "./db";

const SESSION_COOKIE = "tn_sess";
const VISITOR_COOKIE = "tn_vid";
const SESSION_DAYS = 30;

// ---- Gizli anahtar --------------------------------------------------------
// Öncelik SESSION_SECRET ortam değişkeni (Vercel gibi dosya sistemi kalıcı
// olmayan ortamlarda zorunlu). Yerelde yoksa data/secret.key üretilir.

function getSecret(): string {
  const fromEnv = process.env.SESSION_SECRET?.trim();
  if (fromEnv && fromEnv.length >= 16) return fromEnv;

  if (process.env.VERCEL) {
    throw new Error(
      "SESSION_SECRET ortam değişkeni tanımlı değil. Vercel proje ayarlarında " +
        "en az 32 karakterlik rastgele bir değer ekleyin (oturum çerezlerini imzalamak için)."
    );
  }

  const dir = path.join(process.cwd(), "data");
  const file = path.join(dir, "secret.key");
  if (!existsSync(file)) {
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, randomBytes(32).toString("hex"), { encoding: "utf8" });
  }
  return readFileSync(file, "utf8").trim();
}

// ---- Parola: scrypt ----------------------------------------------------------

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;
  const candidate = scryptSync(password, salt, 64);
  const expected = Buffer.from(hash, "hex");
  return candidate.length === expected.length && timingSafeEqual(candidate, expected);
}

// ---- Oturum: HMAC imzalı çerez ------------------------------------------------

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url");
}

export function makeSessionToken(userId: number): string {
  const exp = Date.now() + SESSION_DAYS * 86400_000;
  const payload = Buffer.from(JSON.stringify({ uid: userId, exp })).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function parseSessionToken(token: string | undefined): number | null {
  if (!token) return null;
  const [payload, sig] = token.split(".");
  if (!payload || !sig || sign(payload) !== sig) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as { uid: number; exp: number };
    if (data.exp < Date.now()) return null;
    return data.uid;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<User | null> {
  const jar = await cookies();
  const uid = parseSessionToken(jar.get(SESSION_COOKIE)?.value);
  if (uid === null) return null;
  return (await getUserById(uid)) ?? null;
}

export async function setSessionCookie(userId: number) {
  const jar = await cookies();
  jar.set(SESSION_COOKIE, makeSessionToken(userId), {
    httpOnly: true,
    sameSite: "lax",
    maxAge: SESSION_DAYS * 86400,
    path: "/",
  });
}

export async function clearSessionCookie() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
}

// ---- Ziyaretçi kimliği (misafir oyları için) -----------------------------------

export async function getVisitorId(): Promise<string | null> {
  const jar = await cookies();
  return jar.get(VISITOR_COOKIE)?.value ?? null;
}

/** Yalnızca Route Handler / Server Action içinden çağrılabilir (çerez yazar). */
export async function ensureVisitorId(): Promise<string> {
  const jar = await cookies();
  let vid = jar.get(VISITOR_COOKIE)?.value;
  if (!vid) {
    vid = randomUUID();
    jar.set(VISITOR_COOKIE, vid, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: 365 * 86400,
      path: "/",
    });
  }
  return vid;
}

/** Oy anahtarı: üye ise user-<id>, değilse ziyaretçi çerezi. */
export async function getVoterIdentity(): Promise<{
  voterKey: string;
  userId: number | null;
  weight: number;
}> {
  const user = await getSessionUser();
  if (user) return { voterKey: `user-${user.id}`, userId: user.id, weight: 2 };
  const vid = await ensureVisitorId();
  return { voterKey: `guest-${vid}`, userId: null, weight: 1 };
}
